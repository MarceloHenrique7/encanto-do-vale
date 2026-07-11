import {
  MERCADO_PAGO_PAYMENTS_URL,
  buildIdempotencyKey,
  buildOrderReference,
  getAccessToken,
  getBaseUrl,
  getMercadoPagoError,
  isLocalUrl,
  normalizeOrder,
  readRequestBody,
  sanitizeText,
  setCorsHeaders,
  toMoney,
} from './_payment-utils.js'

export default async function handler(request, response) {
  setCorsHeaders(request, response)

  if (request.method === 'OPTIONS') {
    return response.status(204).json({})
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Metodo nao permitido.' })
  }

  const accessToken = getAccessToken()

  if (!accessToken) {
    return response.status(500).json({
      error: 'Configure MERCADO_PAGO_ACCESS_TOKEN para receber cartao online.',
    })
  }

  let body = {}

  try {
    body = await readRequestBody(request)
  } catch {
    return response.status(400).json({ error: 'Dados do pagamento invalidos.' })
  }

  const order = normalizeOrder(body.order ?? {})

  if (order.error) {
    return response.status(400).json({ error: order.error })
  }

  const token = sanitizeText(body.token, 200)
  const paymentMethodId = sanitizeText(body.payment_method_id, 80)
  const issuerId = sanitizeText(body.issuer_id, 80)
  const installments = Math.min(
    12,
    Math.max(1, Number.parseInt(body.installments, 10) || 1),
  )
  const payerEmail = sanitizeText(body.payer?.email, 120)
  const identificationType = sanitizeText(
    body.payer?.identification?.type,
    10,
  )
  const identificationNumber = sanitizeText(
    body.payer?.identification?.number,
    30,
  )

  if (!token || !paymentMethodId || !payerEmail) {
    return response.status(400).json({
      error: 'Dados do cartao incompletos. Tente novamente.',
    })
  }

  const baseUrl = getBaseUrl(request)
  const externalReference = buildOrderReference('card')
  const notificationUrl = baseUrl && !isLocalUrl(baseUrl)
    ? `${baseUrl}/api/mercado-pago-webhook?source_news=webhooks`
    : undefined

  const paymentPayload = {
    transaction_amount: toMoney(order.total),
    token,
    description: order.description,
    installments,
    payment_method_id: paymentMethodId,
    issuer_id: issuerId || undefined,
    external_reference: externalReference,
    notification_url: notificationUrl,
    payer: {
      email: payerEmail,
      identification:
        identificationType && identificationNumber
          ? {
              type: identificationType,
              number: identificationNumber,
            }
          : undefined,
    },
    metadata: {
      delivery_method: order.deliveryMethod,
      delivery_fee: order.deliveryFee,
      delivery_address: order.customer.address,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      order_notes: order.notes,
    },
  }

  let mercadoPagoResponse

  try {
    mercadoPagoResponse = await fetch(MERCADO_PAGO_PAYMENTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': buildIdempotencyKey('card'),
      },
      body: JSON.stringify(paymentPayload),
    })
  } catch {
    return response.status(502).json({
      error: 'Não foi possível conectar ao Mercado Pago.',
    })
  }

  const data = await mercadoPagoResponse.json().catch(() => ({}))

  if (!mercadoPagoResponse.ok) {
    return response.status(mercadoPagoResponse.status).json({
      error: getMercadoPagoError(
        data,
        'Não foi possível processar o cartão no Mercado Pago.',
      ),
    })
  }

  return response.status(200).json({
    paymentId: data.id,
    status: data.status,
    statusDetail: data.status_detail,
    externalReference,
  })
}
