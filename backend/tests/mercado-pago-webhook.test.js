import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import {
  buildMercadoPagoWebhookManifest,
  validateMercadoPagoWebhookSignature,
} from '../services/mercado-pago-webhook.js'

function sign({ dataId, requestId, timestamp, secret }) {
  const manifest = buildMercadoPagoWebhookManifest({
    dataId,
    requestId,
    timestamp,
  })
  return createHmac('sha256', secret).update(manifest).digest('hex')
}

test('valida assinatura oficial do webhook Mercado Pago', () => {
  const secret = 'segredo-webhook-teste'
  const timestamp = String(Date.now())
  const dataId = '123456789'
  const requestId = 'request-id-teste'
  const signature = sign({ dataId, requestId, timestamp, secret })

  assert.equal(
    validateMercadoPagoWebhookSignature({
      xSignature: `ts=${timestamp},v1=${signature}`,
      xRequestId: requestId,
      dataId,
      secret,
    }),
    true,
  )
})

test('rejeita webhook Mercado Pago com assinatura invalida ou antiga', () => {
  const secret = 'segredo-webhook-teste'
  const timestamp = String(Date.now())

  assert.equal(
    validateMercadoPagoWebhookSignature({
      xSignature: `ts=${timestamp},v1=deadbeef`,
      xRequestId: 'request-id-teste',
      dataId: '123456789',
      secret,
    }),
    false,
  )

  const oldTimestamp = String(Date.now() - 60 * 60_000)
  const oldSignature = sign({
    dataId: '123456789',
    requestId: 'request-id-teste',
    timestamp: oldTimestamp,
    secret,
  })
  assert.equal(
    validateMercadoPagoWebhookSignature({
      xSignature: `ts=${oldTimestamp},v1=${oldSignature}`,
      xRequestId: 'request-id-teste',
      dataId: '123456789',
      secret,
    }),
    false,
  )
})
