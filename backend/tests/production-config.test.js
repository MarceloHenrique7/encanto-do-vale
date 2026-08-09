import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertProductionConfiguration,
  productionConfigurationErrors,
} from '../services/production-config.js'

const managedVariables = [
  'NODE_ENV',
  'DATABASE_URL',
  'SESSION_SECRET',
  'ADMIN_PASSWORD',
  'MERCADO_PAGO_PUBLIC_KEY',
  'MERCADO_PAGO_ACCESS_TOKEN',
  'MERCADO_PAGO_WEBHOOK_SECRET',
  'FRONTEND_URL',
  'BACKEND_URL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_VERIFY_SERVICE_SID',
]
const previousValues = new Map(
  managedVariables.map((name) => [name, process.env[name]]),
)

test.after(() => {
  for (const [name, previous] of previousValues) {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  }
})

test('reporta configuracao incompleta sem derrubar toda a aplicacao', () => {
  process.env.NODE_ENV = 'production'
  for (const name of managedVariables.slice(1)) delete process.env[name]

  const errors = productionConfigurationErrors()
  assert.ok(errors.includes('DATABASE_URL'))
  assert.ok(errors.includes('MERCADO_PAGO_ACCESS_TOKEN'))
  assert.equal(errors.includes('TWILIO_VERIFY'), false)
  const originalWarn = console.warn
  const warnings = []
  console.warn = (message) => warnings.push(String(message))
  try {
    assert.deepEqual(assertProductionConfiguration(), errors)
  } finally {
    console.warn = originalWarn
  }
  assert.equal(warnings.length, 1)
})

test('aceita configuracao de producao completa e coerente', () => {
  process.env.NODE_ENV = 'production'
  process.env.DATABASE_URL = 'postgresql://usuario:senha@host/banco'
  process.env.SESSION_SECRET = 's'.repeat(40)
  process.env.ADMIN_PASSWORD = 'senha-forte-123'
  process.env.MERCADO_PAGO_PUBLIC_KEY = 'APP_USR-publica'
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-token'
  process.env.MERCADO_PAGO_WEBHOOK_SECRET = 'w'.repeat(32)
  process.env.FRONTEND_URL = 'https://encantodovalepnz.com'
  process.env.BACKEND_URL = 'https://encantodovalepnz.com'
  process.env.TWILIO_ACCOUNT_SID = `AC${'a'.repeat(32)}`
  process.env.TWILIO_AUTH_TOKEN = 't'.repeat(32)
  process.env.TWILIO_VERIFY_SERVICE_SID = `VA${'b'.repeat(32)}`

  assert.deepEqual(productionConfigurationErrors(), [])
  assert.doesNotThrow(assertProductionConfiguration)
})
