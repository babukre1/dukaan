import { createHash } from 'node:crypto'
import type pg from 'pg'
import { db, withTransaction } from '../../config/database.js'
import { AppError, notFound } from '../../shared/app-error.js'

type Client = pg.PoolClient
type SaleItemInput = { productId: string; quantity: string }
export type CreateSaleInput = { customerId?: string; items: SaleItemInput[]; discountAmount?: string; paidAmount?: string; paymentMethod?: string; notes?: string }
export type ReturnInput = { items: { saleItemId: string; quantity: string; restock: boolean }[]; debtReductionAmount?: string; refundMethod?: string; reason?: string }

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const cents = (value = '0') => {
  if (!/^\d{1,16}(\.\d{1,2})?$/.test(value)) throw new AppError(400, 'INVALID_MONEY', 'Money values must have at most two decimal places')
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'))
}
const milli = (value: string) => {
  if (!/^\d{1,15}(\.\d{1,3})?$/.test(value)) throw new AppError(400, 'INVALID_QUANTITY', 'Quantities must have at most three decimal places')
  const [whole, fraction = ''] = value.split('.')
  const result = BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, '0'))
  if (result <= 0n) throw new AppError(400, 'INVALID_QUANTITY', 'Quantity must be greater than zero')
  return result
}
const money = (value: bigint) => `${value / 100n}.${String(value % 100n).padStart(2, '0')}`
const quantity = (value: bigint) => `${value / 1000n}.${String(value % 1000n).padStart(3, '0')}`
const roundedDivide = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor
const pageResult = (items: unknown[], page: number, limit: number, total: number) => ({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })

async function mutationLock(client: Client, shopId: string, key: string) {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${shopId}:${key}`])
}

function paymentStatus(total: bigint, paid: bigint) {
  if (paid === total) return 'PAID'
  if (paid === 0n) return 'UNPAID'
  return 'PARTIALLY_PAID'
}

function mergeItems(items: SaleItemInput[]) {
  const merged = new Map<string, bigint>()
  for (const item of items) merged.set(item.productId, (merged.get(item.productId) ?? 0n) + milli(item.quantity))
  return [...merged.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([productId, amount]) => ({ productId, amount }))
}

export async function createSale(shopId: string, userId: string, input: CreateSaleInput, key: string) {
  const payloadHash = hash(input)
  return withTransaction(async client => {
    await mutationLock(client, shopId, `sale:${key}`)
    const duplicate = await client.query('SELECT "id","payloadHash" FROM "sales" WHERE "shopId"=$1 AND "idempotencyKey"=$2', [shopId, key])
    if (duplicate.rowCount) {
      if (duplicate.rows[0].payloadHash !== payloadHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'That idempotency key was already used with different data')
      return saleDetails(client, shopId, duplicate.rows[0].id)
    }

    const merged = mergeItems(input.items)
    const ids = merged.map(item => item.productId)
    const products = await client.query(`SELECT p.*,ib."quantity" FROM "products" p JOIN "inventory_balances" ib ON ib."productId"=p."id" AND ib."shopId"=p."shopId" WHERE p."shopId"=$1 AND p."id"=ANY($2::uuid[]) ORDER BY p."id" FOR UPDATE OF ib`, [shopId, ids])
    if (products.rowCount !== ids.length) throw new AppError(404, 'PRODUCT_NOT_FOUND', 'One or more products were not found')
    const productMap = new Map(products.rows.map(row => [row.id, row]))
    let subtotal = 0n
    const lines = merged.map(item => {
      const product = productMap.get(item.productId)
      if (!product?.isActive) throw new AppError(409, 'PRODUCT_INACTIVE', `${product?.name ?? 'Product'} is archived`)
      const lineSubtotal = roundedDivide(cents(String(product.sellingPrice)) * item.amount, 1000n)
      subtotal += lineSubtotal
      return { ...item, product, lineSubtotal }
    })
    const discount = cents(input.discountAmount ?? '0')
    if (discount > subtotal) throw new AppError(400, 'INVALID_DISCOUNT', 'Discount cannot exceed the subtotal')
    const total = subtotal - discount
    const paid = cents(input.paidAmount ?? '0')
    if (paid > total) throw new AppError(400, 'INVALID_PAYMENT_AMOUNT', 'Paid amount cannot exceed the sale total')
    if (paid > 0n && !input.paymentMethod) throw new AppError(400, 'PAYMENT_METHOD_REQUIRED', 'Select a payment method')
    if (paid < total && !input.customerId) throw new AppError(400, 'CUSTOMER_REQUIRED', 'A customer is required when an amount remains unpaid')
    if (input.customerId) {
      const customer = await client.query('SELECT 1 FROM "customers" WHERE "id"=$1 AND "shopId"=$2 AND "archivedAt" IS NULL FOR UPDATE', [input.customerId, shopId])
      if (!customer.rowCount) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Customer not found')
    }

    const counter = await client.query(`INSERT INTO "sale_counters" ("shopId","nextValue") VALUES ($1,2) ON CONFLICT ("shopId") DO UPDATE SET "nextValue"="sale_counters"."nextValue"+1,"updatedAt"=CURRENT_TIMESTAMP RETURNING "nextValue"-1 AS value`, [shopId])
    const saleNumber = `S-${String(counter.rows[0].value).padStart(6, '0')}`
    const created = await client.query(`INSERT INTO "sales" ("shopId","customerId","saleNumber","subtotal","discountAmount","totalAmount","paidAmount","paymentStatus","paymentMethod","notes","idempotencyKey","payloadHash","createdByUserId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING "id"`, [shopId, input.customerId ?? null, saleNumber, money(subtotal), money(discount), money(total), money(paid), paymentStatus(total, paid), paid > 0n ? input.paymentMethod : null, input.notes?.trim() || null, key, payloadHash, userId])
    const saleId = created.rows[0].id

    for (const line of lines) {
      const updated = await client.query('UPDATE "inventory_balances" SET "quantity"="quantity"-$3,"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "productId"=$1 AND "shopId"=$2 AND "quantity">=$3 RETURNING "quantity"', [line.productId, shopId, quantity(line.amount)])
      if (!updated.rowCount) throw new AppError(409, 'INSUFFICIENT_STOCK', `Insufficient stock for ${line.product.name}`, { productId: line.productId, available: line.product.quantity })
      const after = String(updated.rows[0].quantity)
      await client.query(`INSERT INTO "sale_items" ("shopId","saleId","productId","productNameSnapshot","unitSnapshot","quantity","unitPrice","unitCostSnapshot","lineSubtotal") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [shopId, saleId, line.productId, line.product.name, line.product.unit, quantity(line.amount), line.product.sellingPrice, line.product.costPrice, money(line.lineSubtotal)])
      await client.query(`INSERT INTO "stock_movements" ("shopId","productId","saleId","type","quantityChange","quantityBefore","quantityAfter","note","createdByUserId") VALUES ($1,$2,$3,'SALE',-($4::numeric),$5,$6,$7,$8)`, [shopId, line.productId, saleId, quantity(line.amount), moneyQuantity(BigIntDecimal(after) + line.amount), after, saleNumber, userId])
    }
    if (paid > 0n) await client.query(`INSERT INTO "payments" ("shopId","customerId","saleId","amount","method","notes","receivedAt","createdByUserId") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,$7)`, [shopId, input.customerId ?? null, saleId, money(paid), input.paymentMethod, `Initial payment for ${saleNumber}`, userId])
    const unpaid = total - paid
    if (unpaid > 0n) {
      await client.query(`INSERT INTO "debt_entries" ("shopId","customerId","saleId","type","amount","description","createdByUserId") VALUES ($1,$2,$3,'CREDIT_SALE',$4,$5,$6)`, [shopId, input.customerId, saleId, money(unpaid), `Credit from ${saleNumber}`, userId])
      await client.query('UPDATE "customers" SET "outstandingBalance"="outstandingBalance"+$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2', [input.customerId, shopId, money(unpaid)])
    }
    return saleDetails(client, shopId, saleId)
  })
}

function BigIntDecimal(value: string) {
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole!) * 1000n + BigInt(fraction.padEnd(3, '0').slice(0, 3))
}
const moneyQuantity = quantity

async function saleDetails(executor: Pick<Client, 'query'> | typeof db, shopId: string, id: string) {
  const sale = await executor.query(`SELECT s.*,c."fullName" AS "customerName",c."phoneNumber" AS "customerPhone",sh."name" AS "shopName",sh."phoneNumber" AS "shopPhoneNumber",sh."currencyCode" FROM "sales" s JOIN "shops" sh ON sh."id"=s."shopId" LEFT JOIN "customers" c ON c."id"=s."customerId" AND c."shopId"=s."shopId" WHERE s."id"=$1 AND s."shopId"=$2`, [id, shopId])
  if (!sale.rowCount) throw notFound('Sale not found')
  const [items, returns, payments] = await Promise.all([
    executor.query(`SELECT si.*,COALESCE(SUM(sri."quantity"),0)::text AS "returnedQuantity",COALESCE(SUM(sri."lineRefundAmount"),0)::text AS "returnedAmount" FROM "sale_items" si LEFT JOIN "sale_return_items" sri ON sri."saleItemId"=si."id" WHERE si."saleId"=$1 AND si."shopId"=$2 GROUP BY si."id" ORDER BY si."createdAt",si."id"`, [id, shopId]),
    executor.query(`SELECT sr.*,COALESCE(json_agg(json_build_object('id',sri."id",'saleItemId',sri."saleItemId",'quantity',sri."quantity",'lineRefundAmount',sri."lineRefundAmount",'restock',sri."restock") ORDER BY sri."id") FILTER (WHERE sri."id" IS NOT NULL),'[]') AS items FROM "sale_returns" sr LEFT JOIN "sale_return_items" sri ON sri."saleReturnId"=sr."id" WHERE sr."saleId"=$1 AND sr."shopId"=$2 GROUP BY sr."id" ORDER BY sr."createdAt" DESC`, [id, shopId]),
    executor.query('SELECT "id","amount","method","receivedAt","reversedAt" FROM "payments" WHERE "saleId"=$1 AND "shopId"=$2 ORDER BY "createdAt"', [id, shopId]),
  ])
  return { ...sale.rows[0], initialUnpaidAmount: money(cents(String(sale.rows[0].totalAmount)) - cents(String(sale.rows[0].paidAmount))), items: items.rows, returns: returns.rows, payments: payments.rows }
}

export const getSale = (shopId: string, id: string) => saleDetails(db, shopId, id)
export const getReceipt = getSale

export async function listSales(shopId: string, input: { page: number; limit: number; search?: string; paymentStatus?: string; from?: string; to?: string }) {
  const values: unknown[] = [shopId]
  const where = ['s."shopId"=$1']
  if (input.search) { values.push(`%${input.search.toUpperCase()}%`); where.push(`s."saleNumber" LIKE $${values.length}`) }
  if (input.paymentStatus && input.paymentStatus !== 'ALL') { values.push(input.paymentStatus); where.push(`s."paymentStatus"=$${values.length}::"SalePaymentStatus"`) }
  if (input.from) { values.push(input.from); where.push(`s."createdAt">=$${values.length}::timestamptz`) }
  if (input.to) { values.push(input.to); where.push(`s."createdAt"<=$${values.length}::timestamptz`) }
  const clause = `FROM "sales" s LEFT JOIN "customers" c ON c."id"=s."customerId" AND c."shopId"=s."shopId" WHERE ${where.join(' AND ')}`
  const countValues = [...values]
  values.push(input.limit, (input.page - 1) * input.limit)
  const [rows, count] = await Promise.all([
    db.query(`SELECT s.*,c."fullName" AS "customerName" ${clause} ORDER BY s."createdAt" DESC,s."id" DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values),
    db.query(`SELECT COUNT(*)::int AS count ${clause}`, countValues),
  ])
  return pageResult(rows.rows, input.page, input.limit, count.rows[0].count)
}

export async function voidSale(shopId: string, id: string, userId: string, input: { reason: string; refundIssued?: boolean }, key: string) {
  const payloadHash = hash({ id, ...input })
  return withTransaction(async client => {
    await mutationLock(client, shopId, `void:${key}`)
    const sale = await client.query('SELECT * FROM "sales" WHERE "id"=$1 AND "shopId"=$2 FOR UPDATE', [id, shopId])
    if (!sale.rowCount) throw notFound('Sale not found')
    const row = sale.rows[0]
    if (row.voidIdempotencyKey === key) {
      if (row.voidPayloadHash !== payloadHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'That idempotency key was already used with different data')
      return saleDetails(client, shopId, id)
    }
    if (row.status === 'VOIDED') throw new AppError(409, 'SALE_ALREADY_VOIDED', 'Sale is already voided')
    if (row.status !== 'COMPLETED') throw new AppError(409, 'SALE_HAS_RETURNS', 'A sale with returns cannot be voided')
    if (cents(String(row.paidAmount)) > 0n && input.refundIssued !== true) throw new AppError(409, 'REFUND_REQUIRES_CONFIRMATION', 'Confirm that the paid amount was refunded before voiding')
    const items = await client.query('SELECT * FROM "sale_items" WHERE "saleId"=$1 AND "shopId"=$2 ORDER BY "productId" FOR UPDATE', [id, shopId])
    for (const item of items.rows) {
      const balance = await client.query('UPDATE "inventory_balances" SET "quantity"="quantity"+$3,"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "productId"=$1 AND "shopId"=$2 RETURNING "quantity"', [item.productId, shopId, item.quantity])
      const after = String(balance.rows[0].quantity); const before = quantity(BigIntDecimal(after) - BigIntDecimal(String(item.quantity)))
      await client.query(`INSERT INTO "stock_movements" ("shopId","productId","saleId","type","quantityChange","quantityBefore","quantityAfter","note","createdByUserId") VALUES ($1,$2,$3,'REVERSAL',$4,$5,$6,$7,$8)`, [shopId, item.productId, id, item.quantity, before, after, input.reason, userId])
    }
    const debt = await client.query(`SELECT * FROM "debt_entries" WHERE "saleId"=$1 AND "shopId"=$2 AND "type"='CREDIT_SALE'`, [id, shopId])
    if (debt.rowCount) {
      const amount = String(debt.rows[0].amount)
      const updated = await client.query('UPDATE "customers" SET "outstandingBalance"="outstandingBalance"-$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "outstandingBalance">=$3 RETURNING "id"', [row.customerId, shopId, amount])
      if (!updated.rowCount) throw new AppError(409, 'REFUND_REQUIRES_CONFIRMATION', 'Debt from this sale has already been repaid; use a return with an explicit refund decision')
      await client.query(`INSERT INTO "debt_entries" ("shopId","customerId","saleId","type","amount","description","reversalOfId","createdByUserId") VALUES ($1,$2,$3,'REVERSAL',-($4::numeric),$5,$6,$7)`, [shopId, row.customerId, id, amount, `Void ${row.saleNumber}: ${input.reason}`, debt.rows[0].id, userId])
    }
    await client.query('UPDATE "payments" SET "reversedAt"=CURRENT_TIMESTAMP,"reversalReason"=$3 WHERE "saleId"=$1 AND "shopId"=$2 AND "reversedAt" IS NULL', [id, shopId, input.reason])
    await client.query(`UPDATE "sales" SET "status"='VOIDED',"voidedByUserId"=$3,"voidedAt"=CURRENT_TIMESTAMP,"voidReason"=$4,"voidIdempotencyKey"=$5,"voidPayloadHash"=$6,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2`, [id, shopId, userId, input.reason, key, payloadHash])
    return saleDetails(client, shopId, id)
  })
}

function itemNetAllocations(items: Record<string, unknown>[], total: bigint, subtotal: bigint) {
  if (subtotal === 0n) return new Map(items.map(item => [String(item.id), 0n]))
  let allocated = 0n
  return new Map(items.map((item, index) => {
    const line = cents(String(item.lineSubtotal))
    const net = index === items.length - 1 ? total - allocated : roundedDivide(line * total, subtotal)
    allocated += net
    return [String(item.id), net]
  }))
}

export async function createReturn(shopId: string, saleId: string, userId: string, input: ReturnInput, key: string) {
  const payloadHash = hash({ saleId, ...input })
  return withTransaction(async client => {
    await mutationLock(client, shopId, `return:${key}`)
    const duplicate = await client.query('SELECT "id","payloadHash" FROM "sale_returns" WHERE "shopId"=$1 AND "idempotencyKey"=$2', [shopId, key])
    if (duplicate.rowCount) {
      if (duplicate.rows[0].payloadHash !== payloadHash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'That idempotency key was already used with different data')
      return saleDetails(client, shopId, saleId)
    }
    const saleResult = await client.query('SELECT * FROM "sales" WHERE "id"=$1 AND "shopId"=$2 FOR UPDATE', [saleId, shopId])
    if (!saleResult.rowCount) throw notFound('Sale not found')
    const sale = saleResult.rows[0]
    if (sale.status === 'VOIDED') throw new AppError(409, 'SALE_ALREADY_VOIDED', 'A voided sale cannot be returned')
    if (sale.status === 'RETURNED') throw new AppError(409, 'RETURN_LIMIT_EXCEEDED', 'This sale has already been fully returned')
    const allItems = await client.query(`SELECT si.*,COALESCE(SUM(sri."quantity"),0)::text AS "returnedQuantity",COALESCE(SUM(sri."lineRefundAmount"),0)::text AS "returnedAmount" FROM "sale_items" si LEFT JOIN "sale_return_items" sri ON sri."saleItemId"=si."id" WHERE si."saleId"=$1 AND si."shopId"=$2 GROUP BY si."id" ORDER BY si."id"`, [saleId, shopId])
    const requested = new Map<string, { amount: bigint; restock: boolean }>()
    for (const item of input.items) {
      if (requested.has(item.saleItemId)) throw new AppError(400, 'DUPLICATE_RETURN_ITEM', 'A sale item can only appear once in a return')
      requested.set(item.saleItemId, { amount: milli(item.quantity), restock: item.restock })
    }
    const allocations = itemNetAllocations(allItems.rows, cents(String(sale.totalAmount)), cents(String(sale.subtotal)))
    const returnLines: { item: Record<string, unknown>; amount: bigint; restock: boolean; lineRefund: bigint; unitRefund: bigint }[] = []
    let totalReturn = 0n
    for (const [itemId, request] of requested) {
      const item = allItems.rows.find(row => row.id === itemId)
      if (!item) throw new AppError(404, 'SALE_ITEM_NOT_FOUND', 'Sale item not found')
      const sold = BigIntDecimal(String(item.quantity)); const returned = BigIntDecimal(String(item.returnedQuantity)); const remaining = sold - returned
      if (request.amount > remaining) throw new AppError(409, 'RETURN_LIMIT_EXCEEDED', `Return quantity exceeds the remaining quantity for ${item.productNameSnapshot}`)
      const allocatedNet = allocations.get(itemId)!; const alreadyRefunded = cents(String(item.returnedAmount))
      const lineRefund = request.amount === remaining ? allocatedNet - alreadyRefunded : roundedDivide(allocatedNet * request.amount, sold)
      const cappedRefund = lineRefund > allocatedNet - alreadyRefunded ? allocatedNet - alreadyRefunded : lineRefund
      totalReturn += cappedRefund
      returnLines.push({ item, amount: request.amount, restock: request.restock, lineRefund: cappedRefund, unitRefund: roundedDivide(cappedRefund * 1000n, request.amount) })
    }
    const debtReduction = cents(input.debtReductionAmount ?? '0')
    if (debtReduction > totalReturn) throw new AppError(400, 'INVALID_REFUND', 'Debt reduction cannot exceed the return amount')
    if (debtReduction > 0n && !sale.customerId) throw new AppError(400, 'INVALID_REFUND', 'A walk-in sale cannot reduce customer debt')
    const refund = totalReturn - debtReduction
    if (refund > 0n && !input.refundMethod) throw new AppError(400, 'REFUND_REQUIRES_CONFIRMATION', 'Select how the refund was issued')
    if (debtReduction > 0n) {
      const updated = await client.query('UPDATE "customers" SET "outstandingBalance"="outstandingBalance"-$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "outstandingBalance">=$3 RETURNING "id"', [sale.customerId, shopId, money(debtReduction)])
      if (!updated.rowCount) throw new AppError(409, 'INVALID_REFUND', 'Debt reduction exceeds the customer outstanding balance')
    }
    const number = await client.query('SELECT COALESCE(MAX("returnNumber"),0)+1 AS value FROM "sale_returns" WHERE "saleId"=$1', [saleId])
    const created = await client.query(`INSERT INTO "sale_returns" ("shopId","saleId","returnNumber","totalAmount","debtReductionAmount","refundAmount","refundMethod","reason","idempotencyKey","payloadHash","createdByUserId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING "id"`, [shopId, saleId, number.rows[0].value, money(totalReturn), money(debtReduction), money(refund), refund > 0n ? input.refundMethod : null, input.reason?.trim() || null, key, payloadHash, userId])
    const returnId = created.rows[0].id
    if (debtReduction > 0n) await client.query(`INSERT INTO "debt_entries" ("shopId","customerId","saleId","type","amount","description","createdByUserId") VALUES ($1,$2,$3,'SALE_RETURN',-($4::numeric),$5,$6)`, [shopId, sale.customerId, saleId, money(debtReduction), `Return against ${sale.saleNumber}`, userId])
    for (const line of returnLines) {
      await client.query(`INSERT INTO "sale_return_items" ("shopId","saleReturnId","saleItemId","quantity","unitRefundAmount","lineRefundAmount","restock") VALUES ($1,$2,$3,$4,$5,$6,$7)`, [shopId, returnId, line.item.id, quantity(line.amount), money(line.unitRefund), money(line.lineRefund), line.restock])
      if (line.restock) {
        const balance = await client.query('UPDATE "inventory_balances" SET "quantity"="quantity"+$3,"version"="version"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "productId"=$1 AND "shopId"=$2 RETURNING "quantity"', [line.item.productId, shopId, quantity(line.amount)])
        const after = String(balance.rows[0].quantity); const before = quantity(BigIntDecimal(after) - line.amount)
        await client.query(`INSERT INTO "stock_movements" ("shopId","productId","saleId","saleReturnId","type","quantityChange","quantityBefore","quantityAfter","note","createdByUserId") VALUES ($1,$2,$3,$4,'SALE_RETURN',$5,$6,$7,$8,$9)`, [shopId, line.item.productId, saleId, returnId, quantity(line.amount), before, after, input.reason?.trim() || `Return for ${sale.saleNumber}`, userId])
      }
    }
    const remaining = allItems.rows.reduce((sum, item) => sum + BigIntDecimal(String(item.quantity)) - BigIntDecimal(String(item.returnedQuantity)) - (requested.get(item.id)?.amount ?? 0n), 0n)
    await client.query(`UPDATE "sales" SET "status"=$3::"SaleStatus","updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2`, [saleId, shopId, remaining === 0n ? 'RETURNED' : 'PARTIALLY_RETURNED'])
    return saleDetails(client, shopId, saleId)
  })
}

export async function listReturns(shopId: string, saleId: string) {
  const sale = await getSale(shopId, saleId)
  return sale.returns
}

export async function salesSummary(shopId: string, from?: string, to?: string) {
  const values: unknown[] = [shopId]
  const where = ['s."shopId"=$1']
  if (from) { values.push(from); where.push(`s."createdAt">=$${values.length}::timestamptz`) }
  if (to) { values.push(to); where.push(`s."createdAt"<=$${values.length}::timestamptz`) }
  const result = await db.query(`SELECT
    COALESCE(SUM(CASE WHEN s."status"<>'VOIDED' THEN s."totalAmount"-COALESCE(r."returned",0) ELSE 0 END),0)::text AS "totalSales",
    COUNT(*) FILTER (WHERE s."status"<>'VOIDED')::int AS "saleCount",
    COUNT(*) FILTER (WHERE s."paymentStatus"='PAID' AND s."status"<>'VOIDED')::int AS "paidSales",
    COUNT(*) FILTER (WHERE s."paymentStatus"='UNPAID' AND s."status"<>'VOIDED')::int AS "creditSales",
    COUNT(*) FILTER (WHERE s."paymentStatus"='PARTIALLY_PAID' AND s."status"<>'VOIDED')::int AS "partialSales",
    COUNT(*) FILTER (WHERE s."status" IN ('PARTIALLY_RETURNED','RETURNED'))::int AS "returnedSales",
    COALESCE(SUM(CASE WHEN s."status"<>'VOIDED' THEN s."paidAmount"-COALESCE(r."refunds",0) ELSE 0 END),0)::text AS "immediatePayments",
    COALESCE(SUM(r."refunds"),0)::text AS "refundTotal",
    COALESCE(SUM(CASE WHEN s."paymentStatus"<>'PAID' AND s."status"<>'VOIDED' THEN s."totalAmount"-s."paidAmount"-COALESCE(r."debtReductions",0) ELSE 0 END),0)::text AS "creditSalesValue"
    FROM "sales" s LEFT JOIN (SELECT "saleId",SUM("totalAmount") AS "returned",SUM("refundAmount") AS "refunds",SUM("debtReductionAmount") AS "debtReductions" FROM "sale_returns" GROUP BY "saleId") r ON r."saleId"=s."id"
    WHERE ${where.join(' AND ')}`, values)
  return result.rows[0]
}

export const __testing = { cents, milli, money, quantity, paymentStatus, itemNetAllocations, mergeItems }
