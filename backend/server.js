import { config } from 'dotenv'

import { createApp } from './app.js'

// No desenvolvimento, os segredos ficam no arquivo local ignorado pelo Git.
// Em produção, as variáveis fornecidas pela hospedagem continuam prevalecendo.
config({ path: ['.env.local', '.env'], quiet: true })

const port = Number(process.env.PORT ?? 3000)
const app = createApp()

app.listen(port, () => {
  console.log(`API pronta em http://localhost:${port}`)
})
