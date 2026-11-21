import { createHash } from 'node:crypto'
import type pg from 'pg'
import { db, withTransaction } from '../../config/database.js'
import { AppError, notFound } from '../../shared/app-error.js'
import { normalizePhoneNumber } from '../../shared/phone.js'

type Client = pg.PoolClient
type CustomerInput = { fullName: string; phoneNumber?: string; address?: string; notes?: string; openingBalance?: string }
const payloadHash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const pageResult = (items: unknown[], page: number, limit: number, total: number) => ({ items, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })

async function customerForUpdate(client: Client, shopId: string, customerId: string) {
  const result = await client.query('SELECT * FROM "customers" WHERE "id"=$1 AND "shopId"=$2 AND "archivedAt" IS NULL FOR UPDATE', [customerId, shopId])
  if (!result.rowCount) throw notFound('Customer not found')
  return result.rows[0]
}

async function existingDebtMutation(client: Client, shopId: string, key: string, hash: string) {
  const result = await client.query('SELECT de.*,p."method",p."reference",p."receivedAt" FROM "debt_entries" de LEFT JOIN "payments" p ON p."id"=de."paymentId" WHERE de."shopId"=$1 AND de."idempotencyKey"=$2', [shopId, key])
  if (!result.rowCount) return null
  if (result.rows[0].payloadHash !== hash) throw new AppError(409, 'IDEMPOTENCY_CONFLICT', 'That idempotency key was already used with different data')
  return result.rows[0]
}

export async function listCustomers(shopId: string, input: { page: number; limit: number; search?: string; balance?: string; sort: string; order: string }) {
  const values: unknown[] = [shopId]; const where = ['c."shopId"=$1', 'c."archivedAt" IS NULL']
  if (input.search) { values.push(`%${input.search.toLowerCase()}%`); where.push(`(LOWER(c."fullName") LIKE $${values.length} OR c."phoneNumber" LIKE $${values.length})`) }
  if (input.balance === 'debt') where.push('c."outstandingBalance">0')
  if (input.balance === 'cleared') where.push('c."outstandingBalance"=0')
  const sorts: Record<string, string> = { name: 'c."fullName"', balance: 'c."outstandingBalance"', createdAt: 'c."createdAt"' }
  const sort = sorts[input.sort] ?? sorts.createdAt; const order = input.order === 'asc' ? 'ASC' : 'DESC'
  const clause = `FROM "customers" c WHERE ${where.join(' AND ')}`
  const countValues = [...values]
  values.push(input.limit, (input.page - 1) * input.limit)
  const [rows, count] = await Promise.all([
    db.query(`SELECT c.* ${clause} ORDER BY ${sort} ${order},c."id" LIMIT $${values.length - 1} OFFSET $${values.length}`, values),
    db.query(`SELECT COUNT(*)::int AS count ${clause}`, countValues),
  ])
  return pageResult(rows.rows, input.page, input.limit, count.rows[0].count)
}

export async function createCustomer(shopId: string, userId: string, input: CustomerInput) {
  const phone = input.phoneNumber ? normalizePhoneNumber(input.phoneNumber) : null
  return withTransaction(async (client) => {
    const created = await client.query(`INSERT INTO "customers" ("shopId","fullName","phoneNumber","address","notes") VALUES ($1,$2,$3,$4,$5) RETURNING *`, [shopId, input.fullName.trim(), phone, input.address?.trim() || null, input.notes?.trim() || null])
    const customer = created.rows[0]
    if (input.openingBalance && input.openingBalance !== '0') {
      await client.query(`INSERT INTO "debt_entries" ("shopId","customerId","type","amount","description","createdByUserId") VALUES ($1,$2,'OPENING_BALANCE',$3,'Opening balance',$4)`, [shopId, customer.id, input.openingBalance, userId])
      const updated = await client.query('UPDATE "customers" SET "outstandingBalance"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 RETURNING *', [customer.id, input.openingBalance])
      return updated.rows[0]
    }
    return customer
  })
}

export async function getCustomer(shopId: string, id: string) {
  const result = await db.query(`SELECT c.*,COALESCE(SUM(CASE WHEN de."type"='REPAYMENT' THEN -de."amount" ELSE 0 END),0)::text AS "totalPaid" FROM "customers" c LEFT JOIN "debt_entries" de ON de."customerId"=c."id" AND de."shopId"=c."shopId" WHERE c."id"=$1 AND c."shopId"=$2 GROUP BY c."id"`, [id, shopId])
  if (!result.rowCount) throw notFound('Customer not found')
  return result.rows[0]
}

export async function updateCustomer(shopId: string, id: string, input: Partial<CustomerInput>) {
  const phone = input.phoneNumber === undefined ? undefined : input.phoneNumber ? normalizePhoneNumber(input.phoneNumber) : null
  const result = await db.query(`UPDATE "customers" SET "fullName"=COALESCE($3,"fullName"),"phoneNumber"=CASE WHEN $4::boolean THEN $5 ELSE "phoneNumber" END,"address"=CASE WHEN $6::boolean THEN $7 ELSE "address" END,"notes"=CASE WHEN $8::boolean THEN $9 ELSE "notes" END,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "archivedAt" IS NULL RETURNING *`, [id, shopId, input.fullName?.trim() || null, input.phoneNumber !== undefined, phone ?? null, input.address !== undefined, input.address?.trim() || null, input.notes !== undefined, input.notes?.trim() || null])
  if (!result.rowCount) throw notFound('Customer not found')
  return result.rows[0]
}

export async function archiveCustomer(shopId: string, id: string) {
  const result = await db.query('UPDATE "customers" SET "archivedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "archivedAt" IS NULL RETURNING "id"', [id, shopId])
  if (!result.rowCount) throw notFound('Customer not found')
  return result.rows[0]
}

export async function addDebt(shopId: string, customerId: string, userId: string, input: { amount: string; description?: string; opening?: boolean }, key: string) {
  const hash = payloadHash({ customerId, ...input })
  return withTransaction(async (client) => {
    const duplicate = await existingDebtMutation(client, shopId, key, hash); if (duplicate) return duplicate
    const customer = await customerForUpdate(client, shopId, customerId)
    if (input.opening) {
      const exists = await client.query(`SELECT 1 FROM "debt_entries" WHERE "shopId"=$1 AND "customerId"=$2 AND "type"='OPENING_BALANCE'`, [shopId, customerId])
      if (exists.rowCount) throw new AppError(409, 'OPENING_BALANCE_EXISTS', 'An opening balance has already been recorded')
    }
    const type = input.opening ? 'OPENING_BALANCE' : 'MANUAL_DEBT'
    const entry = await client.query(`INSERT INTO "debt_entries" ("shopId","customerId","type","amount","description","idempotencyKey","payloadHash","createdByUserId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [shopId, customerId, type, input.amount, input.description?.trim() || null, key, hash, userId])
    await client.query('UPDATE "customers" SET "outstandingBalance"="outstandingBalance"+$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2', [customerId, shopId, input.amount])
    return { ...entry.rows[0], previousBalance: customer.outstandingBalance }
  })
}

export async function receivePayment(shopId: string, customerId: string, userId: string, input: { amount: string; method: string; reference?: string; notes?: string; receivedAt?: string }, key: string) {
  const hash = payloadHash({ customerId, ...input })
  return withTransaction(async (client) => {
    const duplicate = await existingDebtMutation(client, shopId, key, hash); if (duplicate) return duplicate
    await customerForUpdate(client, shopId, customerId)
    const updated = await client.query('UPDATE "customers" SET "outstandingBalance"="outstandingBalance"-$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "outstandingBalance">=$3 RETURNING "outstandingBalance"', [customerId, shopId, input.amount])
    if (!updated.rowCount) throw new AppError(409, 'PAYMENT_EXCEEDS_BALANCE', 'Payment cannot exceed the outstanding balance')
    const payment = await client.query(`INSERT INTO "payments" ("shopId","customerId","amount","method","reference","notes","receivedAt","createdByUserId") VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7::timestamptz,CURRENT_TIMESTAMP),$8) RETURNING *`, [shopId, customerId, input.amount, input.method, input.reference?.trim() || null, input.notes?.trim() || null, input.receivedAt || null, userId])
    const entry = await client.query(`INSERT INTO "debt_entries" ("shopId","customerId","paymentId","type","amount","description","idempotencyKey","payloadHash","createdByUserId") VALUES ($1,$2,$3,'REPAYMENT',-$4,$5,$6,$7,$8) RETURNING *`, [shopId, customerId, payment.rows[0].id, input.amount, input.notes?.trim() || 'Payment received', key, hash, userId])
    return { payment: payment.rows[0], ledgerEntry: entry.rows[0], outstandingBalance: updated.rows[0].outstandingBalance }
  })
}

export async function listDebtEntries(shopId: string, customerId: string, page: number, limit: number) {
  await getCustomer(shopId, customerId)
  const [rows, count] = await Promise.all([
    db.query(`SELECT de.*,p."method",p."reference",p."receivedAt",(rb."id" IS NOT NULL) AS "isReversed" FROM "debt_entries" de LEFT JOIN "payments" p ON p."id"=de."paymentId" LEFT JOIN "debt_entries" rb ON rb."reversalOfId"=de."id" WHERE de."shopId"=$1 AND de."customerId"=$2 ORDER BY de."createdAt" DESC,de."id" DESC LIMIT $3 OFFSET $4`, [shopId, customerId, limit, (page - 1) * limit]),
    db.query('SELECT COUNT(*)::int AS count FROM "debt_entries" WHERE "shopId"=$1 AND "customerId"=$2', [shopId, customerId]),
  ])
  return pageResult(rows.rows, page, limit, count.rows[0].count)
}

export async function statement(shopId: string, customerId: string, page: number, limit: number) {
  const [customer, transactions, totals] = await Promise.all([
    getCustomer(shopId, customerId), listDebtEntries(shopId, customerId, page, limit),
    db.query(`SELECT COALESCE(SUM("amount") FILTER (WHERE "amount">0),0)::text AS "totalDebtAdded",COALESCE(-SUM("amount") FILTER (WHERE "amount"<0),0)::text AS "totalRepayments" FROM "debt_entries" WHERE "shopId"=$1 AND "customerId"=$2`, [shopId, customerId]),
  ])
  return { customer, ...totals.rows[0], transactions }
}

export async function reverseDebt(shopId: string, entryId: string, userId: string, reason: string) {
  return withTransaction(async (client) => {
    const original = await client.query('SELECT * FROM "debt_entries" WHERE "id"=$1 AND "shopId"=$2 FOR UPDATE', [entryId, shopId])
    if (!original.rowCount) throw notFound('Debt entry not found')
    const row = original.rows[0]
    if (row.type === 'REVERSAL') throw new AppError(409, 'INVALID_REVERSAL', 'A reversal cannot be reversed')
    const exists = await client.query('SELECT 1 FROM "debt_entries" WHERE "reversalOfId"=$1', [entryId]); if (exists.rowCount) throw new AppError(409, 'ALREADY_REVERSED', 'This transaction is already reversed')
    await customerForUpdate(client, shopId, row.customerId)
    const updated = await client.query('UPDATE "customers" SET "outstandingBalance"="outstandingBalance"-$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "shopId"=$2 AND "outstandingBalance"-$3>=0 RETURNING "outstandingBalance"', [row.customerId, shopId, row.amount])
    if (!updated.rowCount) throw new AppError(409, 'REVERSAL_NEGATIVE_BALANCE', 'Reversal would create a negative balance')
    const reversal = await client.query(`INSERT INTO "debt_entries" ("shopId","customerId","type","amount","description","reversalOfId","createdByUserId") VALUES ($1,$2,'REVERSAL',-$3,$4,$5,$6) RETURNING *`, [shopId, row.customerId, row.amount, reason, entryId, userId])
    if (row.paymentId) await client.query('UPDATE "payments" SET "reversedAt"=CURRENT_TIMESTAMP,"reversalReason"=$2 WHERE "id"=$1', [row.paymentId, reason])
    return { ...reversal.rows[0], outstandingBalance: updated.rows[0].outstandingBalance }
  })
}

export async function debtSummary(shopId: string, from?: string, to?: string) {
  const result = await db.query(`SELECT COALESCE(SUM(c."outstandingBalance"),0)::text AS "totalOutstanding",COUNT(*)::int AS "totalCustomers",COUNT(*) FILTER (WHERE c."outstandingBalance">0)::int AS "customersWithDebt" FROM "customers" c WHERE c."shopId"=$1 AND c."archivedAt" IS NULL`, [shopId])
  const payments = await db.query(`SELECT COALESCE(SUM("amount") FILTER (WHERE "receivedAt">=CURRENT_DATE AND "reversedAt" IS NULL),0)::text AS "receivedToday",COALESCE(SUM("amount") FILTER (WHERE ($2::timestamptz IS NULL OR "receivedAt">=$2) AND ($3::timestamptz IS NULL OR "receivedAt"<$3) AND "reversedAt" IS NULL),0)::text AS "receivedInRange" FROM "payments" WHERE "shopId"=$1`, [shopId, from || null, to || null])
  const recent = await db.query(`SELECT de.*,c."fullName" AS "customerName" FROM "debt_entries" de JOIN "customers" c ON c."id"=de."customerId" WHERE de."shopId"=$1 ORDER BY de."createdAt" DESC LIMIT 10`, [shopId])
  return { ...result.rows[0], ...payments.rows[0], recentTransactions: recent.rows }
}
