import 'dotenv/config'
import { defineConfig } from 'prisma/config'

const runtimeUrl = process.env.DATABASE_URL
const migrationUrl = process.env.DIRECT_URL ?? runtimeUrl?.replace('-pooler.', '.')

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: migrationUrl,
  },
})
