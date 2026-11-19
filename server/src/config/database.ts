import pg from 'pg'
import { env } from './env.js'

const { Pool } = pg
export const db = new Pool({
  connectionString: env.DATABASE_URL,
  // Keep each serverless instance's pool small. Production uses the pooled
  // DATABASE_URL, while local development can use a larger direct pool.
  max: env.NODE_ENV === 'production' ? 5 : env.NODE_ENV === 'test' ? 4 : 12,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  allowExitOnIdle: env.NODE_ENV === 'test',
})

db.on('error', (error) => console.error({ error: error.message }, 'Unexpected PostgreSQL pool error'))

export async function withTransaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function verifyDatabaseConnection(): Promise<void> {
  await db.query('SELECT 1')
}
