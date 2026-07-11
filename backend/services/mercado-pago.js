import { MercadoPagoConfig, Payment } from 'mercadopago'

import { getAccessToken } from '../api/_payment-utils.js'

let cachedToken
let cachedPaymentClient

export function isUsingTestCredentials() {
  return getAccessToken()?.startsWith('TEST-') ?? false
}

export function getPaymentClient() {
  const accessToken = getAccessToken()

  if (!accessToken) {
    const error = new Error('Configure MERCADO_PAGO_ACCESS_TOKEN no backend.')
    error.code = 'MERCADO_PAGO_NOT_CONFIGURED'
    throw error
  }

  if (!cachedPaymentClient || cachedToken !== accessToken) {
    const client = new MercadoPagoConfig({
      accessToken,
      options: { timeout: 10_000 },
    })
    cachedToken = accessToken
    cachedPaymentClient = new Payment(client)
  }

  return cachedPaymentClient
}

export function mapPaymentStatus(status) {
  if (status === 'approved') return 'paid'
  if (status === 'pending' || status === 'in_process') return 'waiting_payment'
  if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(status)) {
    return 'failed'
  }
  return 'pending'
}

export async function createMercadoPagoPayment(body, idempotencyKey) {
  return getPaymentClient().create({
    body,
    requestOptions: {
      idempotencyKey,
      testToken: isUsingTestCredentials(),
    },
  })
}

export async function getMercadoPagoPayment(paymentId) {
  return getPaymentClient().get({
    id: paymentId,
    requestOptions: { testToken: isUsingTestCredentials() },
  })
}
