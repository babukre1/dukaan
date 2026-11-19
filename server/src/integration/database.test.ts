import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import pg from 'pg'

const testDatabaseUrl = process.env.TEST_DATABASE_URL

test('database constraints and transaction rollback', { skip: !testDatabaseUrl }, async () => {
  const pool = new pg.Pool({ connectionString: testDatabaseUrl, max: 1 })
  const client = await pool.connect()
  const phone = `+252${Date.now().toString().slice(-9)}`
  try {
    await client.query('BEGIN')
    await client.query(`INSERT INTO "users" ("id","fullName","phoneNumber","passwordHash","platformRole") VALUES ($1,'Constraint Test',$2,'not-a-real-hash','OWNER')`, [randomUUID(), phone])
    await assert.rejects(
      client.query(`INSERT INTO "users" ("id","fullName","phoneNumber","passwordHash","platformRole") VALUES ($1,'Duplicate Test',$2,'not-a-real-hash','OWNER')`, [randomUUID(), phone]),
      (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === '23505',
    )
    await client.query('ROLLBACK')
    const persisted = await client.query('SELECT 1 FROM "users" WHERE "phoneNumber"=$1', [phone])
    assert.equal(persisted.rowCount, 0)
  } finally {
    await client.query('ROLLBACK').catch(() => undefined)
    client.release()
    await pool.end()
  }
})
