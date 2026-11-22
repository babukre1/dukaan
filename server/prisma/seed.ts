import 'dotenv/config'
import pg from 'pg'
import { readBootstrapAdmin } from '../src/config/bootstrap-admin.js'
import { hashPassword } from '../src/shared/password.js'

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is required')
const pool = new pg.Pool({ connectionString, max: 1 })

const plans = [
  ['WEEKLY_TRIAL', 'Weekly Trial', 'TRIAL', 'DAY', 7],
  ['MONTHLY_TRIAL', 'Monthly Trial', 'TRIAL', 'MONTH', 1],
  ['MONTHLY', 'Monthly', 'PAID', 'MONTH', 1],
  ['YEARLY', 'Yearly', 'PAID', 'YEAR', 1],
] as const

try {
  for (const [code, name, type, unit, count] of plans) {
    await pool.query(`INSERT INTO "subscription_plans" ("code","name","type","durationUnit","durationCount","price","currencyCode")
      VALUES ($1,$2,$3,$4,$5,0,'USD') ON CONFLICT ("code") DO UPDATE SET "name"=EXCLUDED."name","durationUnit"=EXCLUDED."durationUnit","durationCount"=EXCLUDED."durationCount","updatedAt"=CURRENT_TIMESTAMP`, [code, name, type, unit, count])
  }
  const bootstrap = readBootstrapAdmin(process.env)
  if (bootstrap.warning) console.warn(bootstrap.warning)
  if (bootstrap.admin) {
    const passwordHash = await hashPassword(bootstrap.admin.password)
    await pool.query(`INSERT INTO "users" ("fullName","phoneNumber","passwordHash","platformRole","mustChangePassword") VALUES ($1,$2,$3,'ADMIN',TRUE)
      ON CONFLICT ("phoneNumber") DO NOTHING`, [bootstrap.admin.name, bootstrap.admin.phone, passwordHash])
    console.log('Subscription plans seeded and bootstrap admin ensured.')
  } else {
    console.log('Subscription plans seeded. Set BOOTSTRAP_ADMIN_* variables to create the first admin.')
  }
} finally { await pool.end() }
