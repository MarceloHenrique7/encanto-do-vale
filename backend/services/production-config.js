import { isPhoneProviderConfigured } from './phone-verification.js'

function value(name) {
  return String(process.env[name] ?? '').trim()
}

function isHttpsUrl(input) {
  try {
    return new URL(input).protocol === 'https:'
  } catch {
    return false
  }
}

export function productionConfigurationErrors() {
  const errors = []
  const publicKey = value('MERCADO_PAGO_PUBLIC_KEY')
  const accessToken = value('MERCADO_PAGO_ACCESS_TOKEN')

  if (!value('DATABASE_URL')) errors.push('DATABASE_URL')
  if (value('SESSION_SECRET').length < 32) errors.push('SESSION_SECRET')
  if (value('ADMIN_PASSWORD').length < 12) errors.push('ADMIN_PASSWORD')
  if (!publicKey.startsWith('APP_USR-')) {
    errors.push('MERCADO_PAGO_PUBLIC_KEY')
  }
  if (!accessToken.startsWith('APP_USR-')) {
    errors.push('MERCADO_PAGO_ACCESS_TOKEN')
  }
  if (value('MERCADO_PAGO_WEBHOOK_SECRET').length < 16) {
    errors.push('MERCADO_PAGO_WEBHOOK_SECRET')
  }
  if (!isHttpsUrl(value('FRONTEND_URL'))) errors.push('FRONTEND_URL')
  if (!isHttpsUrl(value('BACKEND_URL'))) errors.push('BACKEND_URL')
  if (!isPhoneProviderConfigured()) errors.push('TWILIO_VERIFY')

  return errors
}

export function assertProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return
  const errors = productionConfigurationErrors()
  if (errors.length) {
    throw new Error(
      `Configuracao de producao invalida ou ausente: ${errors.join(', ')}`,
    )
  }
}
