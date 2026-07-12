import { config } from 'dotenv'

import { createApp } from './app.js'
import { migratePostgres, shouldUsePostgres } from './services/postgres.js'

// No desenvolvimento, os segredos ficam no arquivo local ignorado pelo Git.
// Em produção, as variáveis fornecidas pela hospedagem continuam prevalecendo.
config({ path: ['.env.local', '.env'], quiet: true })

const port = Number(process.env.PORT ?? 3000)
const app = createApp()

async function startServer() {
  if (process.env.NODE_ENV === 'production' && !shouldUsePostgres()) {
    throw new Error(
      'DATABASE_URL e obrigatoria em producao; inicializacao cancelada para evitar cadastros em arquivo local.',
    )
  }

  if (shouldUsePostgres()) await migratePostgres()

  app.listen(port, () => {
    console.log(`API pronta em http://localhost:${port}`)
  })
}

startServer().catch((error) => {
  console.error('Falha ao iniciar a API', { message: error?.message })
  process.exitCode = 1
})
