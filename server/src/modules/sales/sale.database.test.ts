import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

test('paid, credit, idempotent, and concurrent sales preserve ledgers', { skip: !testDatabaseUrl }, async () => {
  process.env.DATABASE_URL = testDatabaseUrl
  process.env.NODE_ENV = 'test'
  const { createSale } = await import('./sale.service.js')
  const { db } = await import('../../config/database.js')
  const fixture = new pg.Pool({ connectionString: testDatabaseUrl, max: 1 })
  const userId = randomUUID(); const shopId = randomUUID(); const customerId = randomUUID()
  const paidProductId = randomUUID(); const creditProductId = randomUUID(); const scarceProductId = randomUUID(); const planId = randomUUID()
  const suffix = Date.now().toString()
  try {
    await fixture.query(`INSERT INTO "users" ("id","fullName","phoneNumber","passwordHash","platformRole") VALUES ($1,'Sales Test',$2,'hash','OWNER')`, [userId, `+25261${suffix.slice(-7)}`])
    await fixture.query(`INSERT INTO "shops" ("id","name","phoneNumber") VALUES ($1,'Sales Test Shop',$2)`, [shopId, `+25262${suffix.slice(-7)}`])
    await fixture.query(`INSERT INTO "shop_memberships" ("shopId","userId") VALUES ($1,$2)`, [shopId, userId])
    await fixture.query(`INSERT INTO "subscription_plans" ("id","code","name","type","durationUnit","durationCount","price") VALUES ($1,$2,'Test','PAID','MONTH',1,1)`, [planId, `TEST-${suffix}`])
    await fixture.query(`INSERT INTO "shop_subscriptions" ("shopId","planId","startsAt","expiresAt","snapshotPlanCode","snapshotPrice","currencyCode") VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP+INTERVAL '1 day',$3,1,'USD')`, [shopId, planId, `TEST-${suffix}`])
    await fixture.query(`INSERT INTO "customers" ("id","shopId","fullName") VALUES ($1,$2,'Credit Customer')`, [customerId, shopId])
    for (const [id, name, stock] of [[paidProductId, 'Paid product', '10'], [creditProductId, 'Credit product', '10'], [scarceProductId, 'Scarce product', '5']] as const) {
      await fixture.query(`INSERT INTO "products" ("id","shopId","name","unit","sellingPrice") VALUES ($1,$2,$3,'PIECE',2)`, [id, shopId, name])
      await fixture.query(`INSERT INTO "inventory_balances" ("productId","shopId","quantity") VALUES ($1,$2,$3)`, [id, shopId, stock])
    }

    const paid = await createSale(shopId, userId, { items: [{ productId: paidProductId, quantity: '2' }], paidAmount: '4.00', paymentMethod: 'CASH' }, 'paid-sale')
    assert.equal(paid.paymentStatus, 'PAID')
    assert.equal((await fixture.query('SELECT "quantity"::text FROM "inventory_balances" WHERE "productId"=$1', [paidProductId])).rows[0].quantity, '8.000')
    assert.equal((await fixture.query('SELECT COUNT(*)::int count FROM "payments" WHERE "saleId"=$1', [paid.id])).rows[0].count, 1)

    const creditInput = { customerId, items: [{ productId: creditProductId, quantity: '1' }], paidAmount: '0.00' }
    const credit = await createSale(shopId, userId, creditInput, 'credit-sale')
    const retry = await createSale(shopId, userId, creditInput, 'credit-sale')
    assert.equal(retry.id, credit.id)
    assert.equal((await fixture.query('SELECT "outstandingBalance"::text FROM "customers" WHERE "id"=$1', [customerId])).rows[0].outstandingBalance, '2.00')
    assert.equal((await fixture.query('SELECT "quantity"::text FROM "inventory_balances" WHERE "productId"=$1', [creditProductId])).rows[0].quantity, '9.000')

    const attempts = await Promise.allSettled([
      createSale(shopId, userId, { items: [{ productId: scarceProductId, quantity: '4' }], paidAmount: '8.00', paymentMethod: 'CASH' }, 'concurrent-a'),
      createSale(shopId, userId, { items: [{ productId: scarceProductId, quantity: '4' }], paidAmount: '8.00', paymentMethod: 'CASH' }, 'concurrent-b'),
    ])
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(attempts.filter(result => result.status === 'rejected').length, 1)
    assert.equal((await fixture.query('SELECT "quantity"::text FROM "inventory_balances" WHERE "productId"=$1', [scarceProductId])).rows[0].quantity, '1.000')
  } finally {
    await fixture.query('DELETE FROM "sale_return_items" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "sale_returns" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "stock_movements" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "debt_entries" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "payments" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "sale_items" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "sales" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "sale_counters" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "inventory_balances" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "products" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "customers" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "shop_subscriptions" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "subscription_plans" WHERE "id"=$1', [planId]).catch(() => undefined)
    await fixture.query('DELETE FROM "shop_memberships" WHERE "shopId"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "shops" WHERE "id"=$1', [shopId]).catch(() => undefined)
    await fixture.query('DELETE FROM "users" WHERE "id"=$1', [userId]).catch(() => undefined)
    await fixture.end()
    await db.end()
  }
})
