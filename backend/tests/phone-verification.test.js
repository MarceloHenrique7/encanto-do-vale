import assert from 'node:assert/strict'
import test from 'node:test'

import {
  isPhoneProviderConfigured,
  sendPhoneVerification,
} from '../services/phone-verification.js'

const originalConfiguration = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
  friendlyName: process.env.TWILIO_VERIFY_FRIENDLY_NAME,
  templateSid: process.env.TWILIO_VERIFY_TEMPLATE_SID,
}

test.afterEach(() => {
  for (const [key, value] of Object.entries({
    TWILIO_ACCOUNT_SID: originalConfiguration.accountSid,
    TWILIO_AUTH_TOKEN: originalConfiguration.authToken,
    TWILIO_VERIFY_SERVICE_SID: originalConfiguration.serviceSid,
    TWILIO_VERIFY_FRIENDLY_NAME: originalConfiguration.friendlyName,
    TWILIO_VERIFY_TEMPLATE_SID: originalConfiguration.templateSid,
  })) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

test('não considera credenciais parciais como Twilio configurada', async () => {
  process.env.TWILIO_ACCOUNT_SID = `AC${'a'.repeat(32)}`
  process.env.TWILIO_AUTH_TOKEN = 'token-seguro-de-teste'
  delete process.env.TWILIO_VERIFY_SERVICE_SID

  assert.equal(isPhoneProviderConfigured(), false)
  await assert.rejects(
    sendPhoneVerification('+5575999999999', 'whatsapp'),
    /PHONE_PROVIDER_CONFIGURATION_INVALID/,
  )
})

test('não aceita Content SID no lugar do serviço Verify', async () => {
  process.env.TWILIO_ACCOUNT_SID = `AC${'a'.repeat(32)}`
  process.env.TWILIO_AUTH_TOKEN = 'token-seguro-de-teste'
  process.env.TWILIO_VERIFY_SERVICE_SID = `HX${'b'.repeat(32)}`

  assert.equal(isPhoneProviderConfigured(), false)
  await assert.rejects(
    sendPhoneVerification('+5575999999999', 'whatsapp'),
    /PHONE_PROVIDER_CONFIGURATION_INVALID/,
  )
})
