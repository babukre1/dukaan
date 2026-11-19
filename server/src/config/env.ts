import 'dotenv/config'
import { z } from 'zod'

const developmentSecret = 'development-only-secret-change-before-production'
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:8081'),
  DATABASE_URL: z.string().url().refine((url) => /^postgres(ql)?:\/\//.test(url), 'DATABASE_URL must be PostgreSQL'),
  ACCESS_TOKEN_SECRET: z.string().min(32).default(developmentSecret),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
})

export const env = schema.parse(process.env)
if (env.NODE_ENV === 'production' && env.ACCESS_TOKEN_SECRET === developmentSecret) {
  throw new Error('ACCESS_TOKEN_SECRET must be configured in production')
}
export const corsOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
