const MERCADO_PAGO_PREFERENCES_URL =
  'https://api.mercadopago.com/checkout/preferences'

function toMoney(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.round(parsed * 100) / 100
}

function getBaseUrl(request) {
  const configuredUrl = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '')

  if (configuredUrl) {
    return configuredUrl
  }

  const protocol = request.headers['x-forwarded-proto'] ?? 'https'
  const host = request.headers.host

  return `${protocol}://${host}`
}

function buildOrderReference() {
  return `encanto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Metodo nao permitido.' })
  }

  const sellerAccessToken =
    process.env.MERCADO_PAGO_SELLER_ACCESS_TOKEN?.trim()
  const accessToken =
    sellerAccessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()

  if (!accessToken) {
    return response.status(500).json({
      error:
        'Configure MERCADO_PAGO_ACCESS_TOKEN ou MERCADO_PAGO_SELLER_ACCESS_TOKEN.',
    })
  }

  const {
    items = [],
    deliveryMethod = 'pickup',
    deliveryFee = 0,
    customer = {},
  } = request.body ?? {}

  const checkoutItems = items
    .map((item) => ({
      id: String(item.id ?? '').slice(0, 80),
      title: String(item.title ?? '').slice(0, 120),
      description: String(item.description ?? '').slice(0, 240),
      picture_url: String(item.pictureUrl ?? ''),
      category_id: 'food',
      quantity: Math.max(1, Number.parseInt(item.quantity, 10) || 1),
      currency_id: 'BRL',
      unit_price: toMoney(item.unitPrice),
    }))
    .filter((item) => item.id && item.title && item.unit_price > 0)

  if (!checkoutItems.length) {
    return response.status(400).json({ error: 'Carrinho vazio ou invalido.' })
  }

  const normalizedDeliveryFee = toMoney(deliveryFee)

  if (deliveryMethod === 'delivery' && normalizedDeliveryFee > 0) {
    checkoutItems.push({
      id: 'entrega-local',
      title: 'Entrega local',
      description: 'Taxa de entrega combinada com a loja',
      category_id: 'services',
      quantity: 1,
      currency_id: 'BRL',
      unit_price: normalizedDeliveryFee,
    })
  }

  const productsSubtotal = checkoutItems
    .filter((item) => item.id !== 'entrega-local')
    .reduce((sum, item) => sum + item.unit_price * item.quantity, 0)

  const platformFeePercent = toMoney(process.env.MARKETPLACE_FEE_PERCENT ?? 0)
  const marketplaceFee = toMoney(productsSubtotal * (platformFeePercent / 100))
  const baseUrl = getBaseUrl(request)
  const externalReference = buildOrderReference()
  const notificationUrl = `${baseUrl}/api/mercado-pago-webhook?source_news=webhooks`
  const isLocalBaseUrl =
    baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

  const preference = {
    items: checkoutItems,
    payer: {
      name: String(customer.name ?? '').slice(0, 80) || undefined,
      email: String(customer.email ?? '').slice(0, 120) || undefined,
      phone: customer.phone
        ? {
            number: String(customer.phone).replace(/\D/g, '').slice(0, 20),
          }
        : undefined,
    },
    back_urls: {
      success: `${baseUrl}/?checkout=success&order=${externalReference}`,
      pending: `${baseUrl}/?checkout=pending&order=${externalReference}`,
      failure: `${baseUrl}/?checkout=failure&order=${externalReference}`,
    },
    external_reference: externalReference,
    statement_descriptor: 'ENCANTO DO VALE',
    metadata: {
      delivery_method: deliveryMethod,
      platform_fee_percent: platformFeePercent,
    },
  }

  if (!isLocalBaseUrl) {
    preference.auto_return = 'approved'
    preference.notification_url = notificationUrl
  }

  if (sellerAccessToken && marketplaceFee > 0) {
    preference.marketplace_fee = marketplaceFee
  }

  const mercadoPagoResponse = await fetch(MERCADO_PAGO_PREFERENCES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preference),
  })

  const data = await mercadoPagoResponse.json().catch(() => ({}))

  if (!mercadoPagoResponse.ok) {
    return response.status(mercadoPagoResponse.status).json({
      error: 'Nao foi possivel criar o checkout no Mercado Pago.',
      details: data,
    })
  }

  const useSandboxCheckout = process.env.MERCADO_PAGO_USE_SANDBOX === 'true'

  return response.status(200).json({
    checkoutUrl:
      useSandboxCheckout && data.sandbox_init_point
        ? data.sandbox_init_point
        : data.init_point,
    sandboxCheckoutUrl: data.sandbox_init_point,
    preferenceId: data.id,
    externalReference,
    marketplaceFee: sellerAccessToken ? marketplaceFee : 0,
    splitEnabled: Boolean(sellerAccessToken && marketplaceFee > 0),
  })
}
