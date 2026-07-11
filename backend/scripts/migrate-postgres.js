import { config } from 'dotenv'

import { migratePostgres } from '../services/postgres.js'

config({ path: ['.env.local', '.env'], quiet: true })

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL nao configurada.')
  process.exit(1)
}

await migratePostgres()
console.log('Banco Postgres preparado.')
