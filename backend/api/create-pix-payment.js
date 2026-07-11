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
  setCorsHeaders,
} from './_payment-utils.js'

function extractPixPaymentData(data = {}) {
  const transactionData =
    data?.point_of_interaction?.transaction_data ??
    data?.transaction_data ??
    data?.point_of_interaction?.data ??
    data?.point_of_interaction ??
    {}

  return {
    qrCode:
      transactionData?.qr_code ??
      transactionData?.ticket_url ??
      data?.qr_code ??
      data?.ticket_url ??
      '',
    qrCodeBase64: transactionData?.qr_code_base64 ?? data?.qr_code_base64,
    ticketUrl: transactionData?.ticket_url ?? data?.ticket_url ?? '',
  }
}

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
      error: 'Configure MERCADO_PAGO_ACCESS_TOKEN para gerar Pix online.',
    })
  }

  let body = {}

  try {
    body = await readRequestBody(request)
  } catch {
    return response.status(400).json({ error: 'Dados do pagamento invalidos.' })
  }

  const order = normalizeOrder(body)

  if (order.error) {
    return response.status(400).json({ error: order.error })
  }

  if (![11, 14].includes(order.customer.document.length)) {
    return response.status(400).json({
      error: 'Informe um CPF ou CNPJ válido para gerar o Pix.',
    })
  }

  const baseUrl = getBaseUrl(request)
  const externalReference = buildOrderReference('pix')
  const notificationUrl = baseUrl && !isLocalUrl(baseUrl)
    ? `${baseUrl}/api/mercado-pago-webhook?source_news=webhooks`
    : undefined

  const paymentPayload = {
    transaction_amount: order.total,
    description: order.description,
    payment_method_id: 'pix',
    external_reference: externalReference,
    notification_url: notificationUrl,
    payer: {
      email: order.customer.email,
      first_name: order.customer.name,
      identification: {
        type: order.customer.document.length === 11 ? 'CPF' : 'CNPJ',
        number: order.customer.document,
      },
    },
    metadata: {
      delivery_method: order.deliveryMethod,
      delivery_fee: order.deliveryFee,
      delivery_address: order.customer.address,
      customer_name: order.customer.name,
      customer_phone: order.customer.phone,
      order_notes: order.notes,
      items: order.checkoutItems.map((item) => ({
        id: item.id,
        title: item.title,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
    },
  }

  let mercadoPagoResponse

  try {
    mercadoPagoResponse = await fetch(MERCADO_PAGO_PAYMENTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': buildIdempotencyKey('pix'),
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
        'Não foi possível gerar o Pix no Mercado Pago.',
      ),
    })
  }

  const transactionData = extractPixPaymentData(data)

  if (!transactionData.qrCode && !transactionData.ticketUrl) {
    return response.status(502).json({
      error: 'Nao foi possivel gerar o Pix no Mercado Pago.',
    })
  }

  return response.status(200).json({
    paymentId: data.id,
    status: data.status,
    statusDetail: data.status_detail,
    externalReference,
    total: order.total,
    qrCode: transactionData.qrCode,
    qrCodeBase64: transactionData.qrCodeBase64,
    ticketUrl: transactionData.ticketUrl,
  })
}
