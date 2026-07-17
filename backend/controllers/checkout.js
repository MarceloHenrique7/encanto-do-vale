import { randomUUID } from 'node:crypto'

import {
  getMercadoPagoError,
  normalizeOrderFromStore,
  sanitizeText,
} from '../api/_payment-utils.js'
import {
  createMercadoPagoPayment,
  getMercadoPagoPayment,
  mapPaymentStatus,
} from '../services/mercado-pago.js'
import { validateMercadoPagoWebhookSignature } from '../services/mercado-pago-webhook.js'
import { getStoreHoursStatus } from '../services/store-hours.js'
import { getStoreSettings } from '../services/store-settings.js'
import {
  createOrder,
  findOrder,
  listCustomerOrders,
  updateOrder,
} from '../services/order-store.js'
import {
  expirePendingOrder,
  expirePendingOrders,
} from '../services/order-expiration.js'
import {
  createCustomerSession,
  normalizeBrazilianPhone,
  publicUser,
} from '../services/customer-auth.js'
import { upsertVerifiedUser } from '../services/user-store.js'

function publicOrder(order) {
  return {
    order_id: order.id,
    status: order.status,
    restaurant_status:
      order.restaurant_status ?? (order.status === 'paid' ? 'new' : 'awaiting_payment'),
    payment_id: order.payment_id ?? null,
    payment_status: order.payment_status ?? null,
    payment_method: order.payment_method ?? 'online',
    status_detail: order.status_detail ?? null,
    customer: order.customer,
    items: order.items,
    delivery_method: order.delivery_method,
    delivery_fee: order.delivery_fee,
    deliveryType: order.deliveryType ?? order.delivery_method,
    deliveryFee: order.deliveryFee ?? order.delivery_fee,
    neighborhood: order.neighborhood ?? order.customer?.neighborhood ?? '',
    distanceKm: order.distanceKm ?? 0,
    subtotal: order.subtotal,
    total: order.total,
    created_at: order.created_at,
    updated_at: order.updated_at,
  }
}

function cleanCustomer(body) {
  const customer = body.customer ?? {}
  return {
    name: sanitizeText(customer.name, 80),
    phone: String(customer.phone ?? '').replace(/\D/g, '').slice(0, 20),
    email: sanitizeText(customer.email, 120),
    address: sanitizeText(customer.address, 160),
    number: sanitizeText(customer.number, 20),
    neighborhood: sanitizeText(customer.neighborhood, 80),
    complement: sanitizeText(customer.complement, 120),
  }
}

export async function postOrder(request, response) {
  await getStoreSettings()
  const storeHours = getStoreHoursStatus()
  if (!storeHours.isOpen) {
    return response.status(409).json({
      error: `A loja esta fechada agora. ${storeHours.detail}.`,
    })
  }

  const body = request.body ?? {}
  const customer = cleanCustomer(body)
  const sessionUser = request.customerUser ?? null
  const normalizedPhone = normalizeBrazilianPhone(
    sessionUser?.phone ?? customer.phone,
  )
  customer.name = sanitizeText(sessionUser?.name ?? customer.name, 80)
  customer.phone = normalizedPhone ? normalizedPhone.replace(/\D/g, '') : ''
  const deliveryMethod = 'delivery'

  if (!customer.name) {
    return response.status(400).json({ error: 'Informe o nome do cliente.' })
  }
  if (customer.phone.length < 10) {
    return response.status(400).json({ error: 'Informe um WhatsApp válido.' })
  }
  if (
    deliveryMethod === 'delivery' &&
    (!customer.address || !customer.number || !customer.neighborhood)
  ) {
    return response.status(400).json({
      error: 'Informe endereço, número e bairro para a entrega.',
    })
  }

  // O catálogo do backend é a fonte dos preços. subtotal/total do navegador
  // são deliberadamente ignorados durante este recálculo.
  const normalized = await normalizeOrderFromStore(
    {
      ...body,
      deliveryMethod,
      customer,
    },
    { requireEmail: false },
  )

  if (normalized.error) {
    return response.status(400).json({ error: normalized.error })
  }

  const now = new Date().toISOString()
  const paymentMethod = body.payment_method ?? 'online'
  if (!['online', 'card-delivery'].includes(paymentMethod)) {
    return response.status(400).json({
      error: 'Esta forma de pagamento nao esta disponivel.',
    })
  }
  if (normalized.deliveryMethod === 'delivery') {
    customer.neighborhood = normalized.neighborhood
  }

  const user =
    sessionUser ??
    (await upsertVerifiedUser({
      name: customer.name,
      phone: normalizedPhone,
    }))
  if (!sessionUser) {
    createCustomerSession(response, user.id)
  }

  const subtotal = normalized.subtotal
  const order = {
    id: randomUUID(),
    user_id: user.id,
    status: 'pending',
    restaurant_status:
      paymentMethod === 'online' ? 'awaiting_payment' : 'new',
    payment_status: null,
    payment_method: paymentMethod,
    payment_attempts: 0,
    customer,
    items: normalized.checkoutItems.map((item) => ({
      id: item.id,
      name: item.title,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
    delivery_method: normalized.deliveryMethod,
    delivery_fee: normalized.deliveryFee,
    deliveryType: normalized.deliveryMethod,
    deliveryFee: normalized.deliveryFee,
    neighborhood: normalized.neighborhood,
    distanceKm: normalized.distanceKm,
    subtotal,
    total: normalized.total,
    notes: sanitizeText(body.notes, 500),
    created_at: now,
    updated_at: now,
  }

  await createOrder(order)

  return response.status(201).json({
    order_id: order.id,
    total: order.total,
    user: publicUser(user),
  })
}

function normalizePublicUrl(value) {
  const rawValue = String(value ?? '').trim().replace(/\/$/, '')
  if (!rawValue) return ''

  try {
    const url = new URL(rawValue)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

function publicBackendUrl(request) {
  return (
    normalizePublicUrl(process.env.BACKEND_URL) ||
    normalizePublicUrl(process.env.RENDER_EXTERNAL_URL) ||
    normalizePublicUrl(`${request.protocol}://${request.get('host')}`)
  )
}

function paymentBodyFrom(order, formData, request) {
  const paymentMethodId = sanitizeText(formData.payment_method_id, 80)
  const payer = formData.payer ?? {}
  const email = sanitizeText(payer.email, 120)
  const token = sanitizeText(formData.token, 300)
  const installments = Math.min(
    12,
    Math.max(1, Number.parseInt(formData.installments, 10) || 1),
  )
  const issuerId = Number.parseInt(formData.issuer_id, 10)
  const identificationType = sanitizeText(payer.identification?.type, 10)
  const identificationNumber = sanitizeText(
    payer.identification?.number,
    30,
  )

  if (!paymentMethodId || !email) {
    const error = new Error('Dados do pagamento incompletos.')
    error.code = 'INVALID_PAYMENT'
    throw error
  }
  if (paymentMethodId !== 'pix' && !token) {
    const error = new Error('Token do cartão não recebido. Tente novamente.')
    error.code = 'INVALID_PAYMENT'
    throw error
  }

  const backendUrl = publicBackendUrl(request)

  return {
    transaction_amount: order.total,
    token: token || undefined,
    description: `Pedido Delivery #${order.id}`,
    installments,
    payment_method_id: paymentMethodId,
    issuer_id: Number.isFinite(issuerId) ? issuerId : undefined,
    payer: {
      email,
      first_name: order.customer.name,
      identification:
        identificationType && identificationNumber
          ? { type: identificationType, number: identificationNumber }
          : undefined,
    },
    external_reference: order.id,
    notification_url: backendUrl
      ? `${backendUrl}/api/webhooks/mercadopago`
      : undefined,
    metadata: {
      order_id: order.id,
      customer_phone: order.customer.phone,
      delivery_method: order.delivery_method,
    },
    additional_info: {
      items: order.items.map((item) => ({
        id: item.id,
        title: item.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    },
  }
}

export async function postProcessPayment(request, response) {
  const orderId = sanitizeText(request.body?.order_id, 80)
  const formData = request.body?.formData ?? {}
  const order = await expirePendingOrder(await findOrder(orderId))

  if (!order) {
    return response.status(404).json({ error: 'Pedido não encontrado.' })
  }
  if (order.user_id !== request.customerUser.id) {
    return response.status(404).json({ error: 'Pedido não encontrado.' })
  }
  if (order.status === 'paid') {
    return response.status(409).json({ error: 'Este pedido já foi pago.' })
  }

  if (order.status === 'failed') {
    return response.status(409).json({
      error: 'Este pedido expirou. Refaca o pedido para gerar um novo pagamento.',
    })
  }

  let paymentBody
  try {
    paymentBody = paymentBodyFrom(order, formData, request)
  } catch (error) {
    return response.status(400).json({ error: error.message })
  }

  const attempt = (order.payment_attempts ?? 0) + 1
  await updateOrder(order.id, { payment_attempts: attempt })

  try {
    const payment = await createMercadoPagoPayment(
      paymentBody,
      `${order.id}-${attempt}`,
    )
    const orderStatus = mapPaymentStatus(payment.status)
    const restaurantStatus =
      orderStatus === 'paid' &&
      (!order.restaurant_status ||
        order.restaurant_status === 'awaiting_payment')
        ? 'new'
        : order.restaurant_status
    await updateOrder(order.id, {
      status: orderStatus,
      restaurant_status: restaurantStatus,
      payment_id: String(payment.id),
      payment_status: payment.status,
      status_detail: payment.status_detail,
    })

    return response.json({
      payment_id: payment.id,
      status: payment.status,
      status_detail: payment.status_detail,
      order_id: order.id,
      point_of_interaction: payment.point_of_interaction ?? null,
    })
  } catch (error) {
    const status = Number(error?.status) || 502
    const safeStatus = status >= 400 && status < 600 ? status : 502
    console.error('Falha ao criar pagamento Mercado Pago', {
      orderId: order.id,
      status: error?.status,
      message: error?.message,
    })
    return response.status(safeStatus).json({
      error:
        error?.code === 'MERCADO_PAGO_NOT_CONFIGURED'
          ? error.message
          : getMercadoPagoError(
              error,
              safeStatus === 401
                ? 'O Mercado Pago não autorizou estas credenciais para criar o pagamento.'
                : 'Não foi possível processar o pagamento. Confira os dados e tente novamente.',
            ),
    })
  }
}

export async function postMercadoPagoWebhook(request, response) {
  const paymentId =
    request.query?.['data.id'] ??
    request.body?.data?.id ??
    request.body?.id ??
    request.query?.id

  const webhookSecret = String(process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? '')
  if (webhookSecret) {
    const validSignature = validateMercadoPagoWebhookSignature({
      xSignature: request.headers['x-signature'],
      xRequestId: request.headers['x-request-id'],
      dataId: paymentId,
      secret: webhookSecret,
    })
    if (!validSignature) {
      console.warn('Webhook Mercado Pago com assinatura invalida')
      return response.status(401).json({ received: false })
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('MERCADO_PAGO_WEBHOOK_SECRET nao configurado em producao')
    return response.status(503).json({ received: false })
  }
  // Respondemos 200 a notificações sem id para evitar retentativas inúteis.
  if (!/^\d{1,30}$/.test(String(paymentId ?? ''))) {
    console.warn('Webhook Mercado Pago sem payment_id válido')
    return response.status(200).json({ received: true })
  }

  try {
    const payment = await getMercadoPagoPayment(paymentId)
    const orderId = sanitizeText(payment.external_reference, 80)
    const order = await findOrder(orderId)

    console.info('Webhook Mercado Pago', {
      paymentId: String(payment.id),
      orderId,
      status: payment.status,
      statusDetail: payment.status_detail,
      orderFound: Boolean(order),
    })

    if (order) {
      const orderStatus = mapPaymentStatus(payment.status)
      const restaurantStatus =
        orderStatus === 'paid' &&
        (!order.restaurant_status ||
          order.restaurant_status === 'awaiting_payment')
          ? 'new'
          : order.restaurant_status
      await updateOrder(order.id, {
        status: orderStatus,
        restaurant_status: restaurantStatus,
        payment_id: String(payment.id),
        payment_status: payment.status,
        status_detail: payment.status_detail,
      })
    }

    return response.status(200).json({ received: true })
  } catch (error) {
    console.error('Falha ao consultar webhook Mercado Pago', {
      paymentId: String(paymentId),
      message: error?.message,
    })
    return response.status(500).json({ received: false })
  }
}

export async function getOrder(request, response) {
  const order = await expirePendingOrder(
    await findOrder(sanitizeText(request.params.id, 80)),
  )

  if (!order) {
    return response.status(404).json({ error: 'Pedido não encontrado.' })
  }
  if (order.user_id !== request.customerUser.id) {
    return response.status(404).json({ error: 'Pedido não encontrado.' })
  }

  return response.json(publicOrder(order))
}

export async function getCustomerOrders(request, response) {
  const orders = await expirePendingOrders(
    await listCustomerOrders(request.customerUser.id),
  )
  return response.json({ orders: orders.map(publicOrder) })
}
