import { getCatalog, getCatalogSnapshot } from '../services/catalog-store.js'
import { getCachedStoreSettings } from '../services/store-settings.js'
import { formatCurrencyBRL, validateDeliveryZone } from '../utils/deliveryFee.js'

export const MERCADO_PAGO_PAYMENTS_URL =
  'https://api.mercadopago.com/v1/payments'

export function normalizeHeader(value) {
  return Array.isArray(value) ? value[0] : value
}

export function isLocalUrl(url) {
  return url.includes('localhost') || url.includes('127.0.0.1')
}

export function setCorsHeaders(request, response) {
  const allowedOrigin = process.env.CHECKOUT_ALLOWED_ORIGIN?.trim()
  const origin = normalizeHeader(request.headers.origin)

  if (allowedOrigin && origin === allowedOrigin) {
    response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
    response.setHeader('Access-Control-Allow-Credentials', 'true')
  }

  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

export function toMoney(value) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0
  }

  return Math.round(parsed * 100) / 100
}

export function hasValidExtraGroupSelections(product, requestedExtraIds) {
  return (product.extraGroups ?? []).every((group) => {
    const selectedCount = requestedExtraIds.filter((extraId) =>
      group.extraIds.includes(extraId),
    ).length
    return selectedCount <= group.maxSelections
  })
}

export function toCents(value) {
  return Math.round(toMoney(value) * 100)
}

export function fromCents(value) {
  return value / 100
}

export function sanitizeText(value, maxLength) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

export function sanitizePhone(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 20)
}

export function sanitizeDocument(value) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 14)
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim())
}

export function buildOrderReference(prefix = 'encanto') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function buildIdempotencyKey(prefix = 'encanto') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`
}

export function getBaseUrl(request) {
  const configuredUrl = process.env.PUBLIC_SITE_URL?.replace(/\/$/, '')
  const host = normalizeHeader(request.headers['x-forwarded-host']) ??
    normalizeHeader(request.headers.host)
  const protocolHeader = normalizeHeader(request.headers['x-forwarded-proto'])
  const protocol = protocolHeader || (host && isLocalUrl(host) ? 'http' : 'https')
  const requestUrl = host ? `${protocol}://${host}` : ''

  if (configuredUrl && !isLocalUrl(configuredUrl)) {
    return configuredUrl
  }

  return requestUrl || configuredUrl
}

export async function readRequestBody(request) {
  if (!request.body) {
    return {}
  }

  if (typeof request.body === 'object' && !Buffer.isBuffer(request.body)) {
    return request.body
  }

  const rawBody = Buffer.isBuffer(request.body)
    ? request.body.toString('utf8')
    : String(request.body)

  if (Buffer.byteLength(rawBody, 'utf8') > 100_000) {
    throw new Error('PAYLOAD_TOO_LARGE')
  }

  return rawBody ? JSON.parse(rawBody) : {}
}

export function getAccessToken() {
  const accessToken =
    process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim() ||
    process.env.MERCADO_PAGO_SELLER_ACCESS_TOKEN?.trim()

  if (
    !accessToken ||
    /sua|seu|your|troque|exemplo/i.test(accessToken)
  ) {
    return undefined
  }

  return accessToken
}

export function getMercadoPagoError(data, fallback) {
  const message = sanitizeText(data?.message, 180)
  const cause = Array.isArray(data?.cause)
    ? data.cause
        .map((entry) =>
          sanitizeText(entry?.description || entry?.code, 120),
        )
        .filter(Boolean)
        .slice(0, 2)
        .join(' ')
    : ''
  const rawDetails = `${message} ${cause}`.toLowerCase()

  if (rawDetails.includes('unauthorized use of live credentials')) {
    return (
      'Credenciais de produção não autorizadas para este teste. ' +
      'Use a Public Key e o Access Token de teste da mesma aplicação.'
    )
  }

  return [...new Set([fallback, message, cause].filter(Boolean))].join(' — ')
}

function normalizeOrderWithCatalog(catalog, body, { requireEmail = true } = {}) {
  const {
    items = [],
    customer = {},
    notes = '',
  } = body
  const deliveryMethod = body.deliveryMethod ?? body.delivery_method ?? 'pickup'
  const customerName = sanitizeText(customer.name, 80)
  const customerPhone = sanitizePhone(customer.phone)
  const customerEmail = sanitizeText(customer.email, 120)
  const customerDocument = sanitizeDocument(customer.document)
  const customerAddress = sanitizeText(customer.address, 240)
  const customerNeighborhood = sanitizeText(customer.neighborhood, 80)
  const orderNotes = sanitizeText(notes, 500)

  if (!customerName) {
    return { error: 'Informe o nome do cliente.' }
  }

  if (customerPhone.length < 10) {
    return { error: 'Informe um telefone valido.' }
  }

  if (requireEmail && !isValidEmail(customerEmail)) {
    return { error: 'Informe um e-mail valido para o pagamento online.' }
  }

  if (deliveryMethod === 'delivery' && !customerAddress) {
    return { error: 'Informe o endereco de entrega.' }
  }

  const normalizedDeliveryMethod =
    deliveryMethod === 'delivery' ? 'delivery' : 'pickup'
  const deliveryZone =
    normalizedDeliveryMethod === 'delivery'
      ? validateDeliveryZone(customerNeighborhood)
      : null

  if (deliveryZone && !deliveryZone.available) {
    return { error: deliveryZone.message }
  }
  const inputItems = Array.isArray(items) ? items.slice(0, 50) : []
  const normalizedItems = inputItems
    .map((item) => {
      const productId = sanitizeText(item.productId ?? item.id, 80)
      const product = catalog.products.find(
        (catalogProduct) => catalogProduct.id === productId,
      )

      if (!product?.isAvailable) {
        return null
      }

      const optionId = sanitizeText(item.optionId, 80)
      const option = optionId
        ? product.options?.find((entry) => entry.id === optionId)
        : undefined

      if ((product.options?.length && !option) || (optionId && !option)) {
        return null
      }

      const requestedExtraIds = Array.isArray(item.extraIds)
        ? [...new Set(item.extraIds.map((id) => sanitizeText(id, 80)))]
        : []
      const selectedExtras = requestedExtraIds.flatMap((extraId) => {
        const extra = product.extras?.find((entry) => entry.id === extraId)
        return extra ? [extra] : []
      })

      if (selectedExtras.length !== requestedExtraIds.length) {
        return null
      }

      if (!hasValidExtraGroupSelections(product, requestedExtraIds)) {
        return null
      }

      const unitPriceInCents =
        toCents(option?.price ?? product.basePrice) +
        selectedExtras.reduce(
          (total, extra) => total + toCents(extra.price),
          0,
        )
      const title = option
        ? `${product.name} - ${option.label}`
        : product.name
      const clientUnitPriceInCents = toCents(
        item.unitPrice ?? item.unit_price ?? option?.price ?? product.basePrice,
      )

      return {
        id: sanitizeText(item.id, 80),
        title: sanitizeText(title, 120),
        description: sanitizeText(product.description, 240),
        quantity: Math.min(
          99,
          Math.max(1, Number.parseInt(item.quantity, 10) || 1),
        ),
        unitPrice: fromCents(unitPriceInCents),
        hasPriceMismatch: clientUnitPriceInCents !== unitPriceInCents,
      }
    })
    .filter(Boolean)

  if (normalizedItems.some((item) => item.hasPriceMismatch)) {
    return {
      error:
        'O preço do carrinho está desatualizado. Recarregue o catálogo antes de pagar.',
    }
  }

  const checkoutItems = normalizedItems
    .filter(
      (item) =>
        item.id &&
        item.title &&
        item.unitPrice > 0 &&
        item.unitPrice <= 100_000,
    )
    .map(({ hasPriceMismatch: _hasPriceMismatch, ...item }) => item)

  if (!checkoutItems.length) {
    return { error: 'Carrinho vazio ou invalido.' }
  }

  const normalizedDeliveryFee =
    normalizedDeliveryMethod === 'delivery' ? deliveryZone.deliveryFee : 0
  const productsSubtotalInCents = checkoutItems.reduce(
    (sum, item) => sum + toCents(item.unitPrice) * item.quantity,
    0,
  )
  const total = fromCents(
    productsSubtotalInCents + toCents(normalizedDeliveryFee),
  )
  const subtotal = fromCents(productsSubtotalInCents)
  const minimumOrder = getCachedStoreSettings().minimumOrder
  if (subtotal < minimumOrder) {
    return {
      error: `O pedido mínimo é ${formatCurrencyBRL(minimumOrder)} sem contar a entrega.`,
    }
  }

  return {
    checkoutItems,
    deliveryMethod: normalizedDeliveryMethod,
    deliveryFee: normalizedDeliveryFee,
    distanceKm: deliveryZone?.distanceKm ?? 0,
    neighborhood: deliveryZone?.neighborhood ?? '',
    subtotal,
    customer: {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      document: customerDocument,
      address: customerAddress,
      neighborhood: deliveryZone?.neighborhood ?? '',
    },
    notes: orderNotes,
    total,
    description: `Pedido Encanto do Vale - ${checkoutItems.length} item(ns)`,
  }
}

export function normalizeOrder(body, { requireEmail = true } = {}) {
  return normalizeOrderWithCatalog(getCatalogSnapshot(), body, { requireEmail })
}

export async function normalizeOrderFromStore(body, { requireEmail = true } = {}) {
  return normalizeOrderWithCatalog(await getCatalog(), body, { requireEmail })
}
