import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

import createCheckoutHandler from './api/create-checkout.js'

function loadLocalEnvFile() {
  const envPath = fileURLToPath(new URL('./.env.local', import.meta.url))

  if (!existsSync(envPath)) {
    return {}
  }

  return readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .reduce<Record<string, string>>((accumulator, line) => {
      const separatorIndex = line.indexOf('=')
      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()

      if (key) {
        accumulator[key] = value
      }

      return accumulator
    }, {})
}

function mercadoPagoDevApiPlugin(): Plugin {
  return {
    name: 'mercado-pago-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/create-checkout', async (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify({ error: 'Metodo nao permitido.' }))
          return
        }

        try {
          Object.assign(process.env, loadLocalEnvFile())

          const chunks: Buffer[] = []

          for await (const chunk of request) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }

          const rawBody = Buffer.concat(chunks).toString('utf8')
          const body = rawBody ? JSON.parse(rawBody) : {}
          const url = new URL(request.url ?? '/api/create-checkout', 'http://localhost')
          const apiRequest = {
            method: request.method,
            headers: request.headers,
            body,
            query: Object.fromEntries(url.searchParams.entries()),
          }

          const apiResponse = {
            statusCode: 200,
            setHeader(name: string, value: string) {
              response.setHeader(name, value)
            },
            status(statusCode: number) {
              this.statusCode = statusCode
              return this
            },
            json(payload: unknown) {
              response.statusCode = this.statusCode
              response.setHeader('Content-Type', 'application/json')
              response.end(JSON.stringify(payload))
              return this
            },
          }

          await createCheckoutHandler(apiRequest, apiResponse)
        } catch (error) {
          console.error('Erro no checkout local Mercado Pago', error)
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json')
          response.end(
            JSON.stringify({
              error: 'Erro ao processar checkout local.',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  Object.assign(process.env, env, loadLocalEnvFile())

  return {
    plugins: [react(), mercadoPagoDevApiPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
