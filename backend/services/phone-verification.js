import { randomInt } from 'node:crypto'
import twilio from 'twilio'

const developmentCodes = new Map()

function twilioConfiguration() {
  return {
    accountSid: String(process.env.TWILIO_ACCOUNT_SID ?? '').trim(),
    authToken: String(process.env.TWILIO_AUTH_TOKEN ?? '').trim(),
    serviceSid: String(process.env.TWILIO_VERIFY_SERVICE_SID ?? '').trim(),
    friendlyName: String(
      process.env.TWILIO_VERIFY_FRIENDLY_NAME ?? 'Encanto do Vale',
    ).trim(),
    templateSid: String(process.env.TWILIO_VERIFY_TEMPLATE_SID ?? '').trim(),
  }
}

function phoneProviderConfiguration() {
  const configuration = twilioConfiguration()
  const hasAnyValue = [
    configuration.accountSid,
    configuration.authToken,
    configuration.serviceSid,
  ].some(Boolean)
  const hasValidTemplate =
    !configuration.templateSid ||
    /^HJ[a-f0-9]{32}$/i.test(configuration.templateSid)
  const isValid = Boolean(
    /^AC[a-f0-9]{32}$/i.test(configuration.accountSid) &&
      configuration.authToken.length >= 16 &&
      /^VA[a-f0-9]{32}$/i.test(configuration.serviceSid) &&
      configuration.friendlyName &&
      hasValidTemplate,
  )
  return { configuration, hasAnyValue, isValid }
}

export function isPhoneProviderConfigured() {
  return phoneProviderConfiguration().isValid
}

export async function sendPhoneVerification(phone, channel) {
  const provider = phoneProviderConfiguration()
  if (provider.isValid) {
    const { configuration } = provider
    const client = twilio(configuration.accountSid, configuration.authToken)
    const verificationOptions = {
      to: phone,
      channel,
      customFriendlyName: configuration.friendlyName,
      locale: 'pt-BR',
      ...(channel === 'sms' && configuration.templateSid
        ? { templateSid: configuration.templateSid }
        : {}),
    }
    await client.verify.v2
      .services(configuration.serviceSid)
      .verifications.create(verificationOptions)
    return { provider: 'twilio' }
  }

  // Credenciais parciais não podem cair silenciosamente no código local:
  // isso faria a interface afirmar que enviou uma mensagem que nunca saiu.
  if (provider.hasAnyValue) {
    throw new Error('PHONE_PROVIDER_CONFIGURATION_INVALID')
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PHONE_PROVIDER_NOT_CONFIGURED')
  }

  const code = String(randomInt(100000, 1000000))
  developmentCodes.set(phone, {
    code,
    expiresAt: Date.now() + 10 * 60_000,
    attempts: 0,
  })
  return { provider: 'development', developmentCode: code }
}

export async function checkPhoneVerification(phone, code) {
  const provider = phoneProviderConfiguration()
  if (provider.isValid) {
    const { configuration } = provider
    const client = twilio(configuration.accountSid, configuration.authToken)
    const verification = await client.verify.v2
      .services(configuration.serviceSid)
      .verificationChecks.create({ to: phone, code })
    return verification.status === 'approved'
  }

  if (provider.hasAnyValue) {
    throw new Error('PHONE_PROVIDER_CONFIGURATION_INVALID')
  }

  if (process.env.NODE_ENV === 'production') return false
  const verification = developmentCodes.get(phone)
  if (!verification || verification.expiresAt < Date.now()) {
    developmentCodes.delete(phone)
    return false
  }
  verification.attempts += 1
  if (verification.attempts > 5) {
    developmentCodes.delete(phone)
    return false
  }
  const approved = verification.code === String(code)
  if (approved) developmentCodes.delete(phone)
  return approved
}
