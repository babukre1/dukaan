import 'dotenv/config'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL?.replace('-pooler.', '.')
if (!connectionString) throw new Error('DIRECT_URL or DATABASE_URL is required')

const migrationsDirectory = path.resolve('prisma/migrations')
const pool = new pg.Pool({ connectionString, max: 1 })
const checksum = (sql: string) => createHash('sha256').update(sql).digest('hex')

try {
  const client = await pool.connect()
  try {
    await client.query('SELECT pg_advisory_lock($1)', [731_947_201])
    await client.query(`CREATE TABLE IF NOT EXISTS "_dukaan_migrations" (
      "name" TEXT PRIMARY KEY, "checksum" CHAR(64) NOT NULL, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    const entries = (await readdir(migrationsDirectory, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
    for (const name of entries) {
      const sql = await readFile(path.join(migrationsDirectory, name, 'migration.sql'), 'utf8')
      const digest = checksum(sql)
      const applied = await client.query('SELECT "checksum" FROM "_dukaan_migrations" WHERE "name"=$1', [name])
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== digest) throw new Error(`Applied migration ${name} has been modified`)
        console.log(`Migration already applied: ${name}`)
        continue
      }
      const prismaApplied = await client.query(`SELECT to_regclass('"_prisma_migrations"') AS table_name`)
      if (prismaApplied.rows[0].table_name) {
        const found = await client.query('SELECT 1 FROM "_prisma_migrations" WHERE "migration_name"=$1 AND "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL', [name])
        if (found.rowCount) {
          await client.query('INSERT INTO "_dukaan_migrations" ("name","checksum") VALUES ($1,$2)', [name, digest])
          console.log(`Migration imported from Prisma history: ${name}`)
          continue
        }
      }
      console.log(`Applying migration: ${name}`)
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO "_dukaan_migrations" ("name","checksum") VALUES ($1,$2)', [name, digest])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
    console.log('Database migrations are up to date.')
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [731_947_201]).catch(() => undefined)
    client.release()
  }
} finally {
  await pool.end()
}
