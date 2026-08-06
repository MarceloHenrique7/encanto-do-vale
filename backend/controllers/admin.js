import { sanitizeText } from '../api/_payment-utils.js'
import {
  authenticatePassword,
  clearAdminSession,
  createAdminSession,
  hasValidAdminSession,
  isAdminConfigured,
} from '../services/admin-auth.js'
import {
  findOrder,
  listCompletedOrders,
  listOrders,
  updateOrder,
} from '../services/order-store.js'
import { listUsers } from '../services/user-store.js'
import { expirePendingOrders } from '../services/order-expiration.js'
import { subscribeToOrderChanges } from '../services/order-events.js'

const allowedRestaurantStatuses = new Set([
  'new',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'cancelled',
])
const loginAttempts = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip) ?? { count: 0, resetAt: now + 60_000 }
  if (entry.resetAt <= now) {
    loginAttempts.set(ip, { count: 0, resetAt: now + 60_000 })
    return false
  }
  return entry.count >= 8
}

function registerFailure(ip) {
  const now = Date.now()
  const entry = loginAttempts.get(ip) ?? { count: 0, resetAt: now + 60_000 }
  loginAttempts.set(ip, { ...entry, count: entry.count + 1 })
}

export function getAdminSession(request, response) {
  response.json({
    authenticated: hasValidAdminSession(request),
    configured: isAdminConfigured(),
  })
}

export function postAdminLogin(request, response) {
  if (!isAdminConfigured()) {
    return response.status(503).json({
      error: 'Configure ADMIN_PASSWORD e SESSION_SECRET no backend.',
    })
  }

  const ip = request.ip ?? 'unknown'
  if (isRateLimited(ip)) {
    return response.status(429).json({
      error: 'Muitas tentativas. Aguarde um minuto.',
    })
  }
  if (!authenticatePassword(request.body?.password)) {
    registerFailure(ip)
    return response.status(401).json({ error: 'Senha incorreta.' })
  }

  loginAttempts.delete(ip)
  createAdminSession(response)
  return response.json({ authenticated: true })
}

export function postAdminLogout(_request, response) {
  clearAdminSession(response)
  return response.json({ authenticated: false })
}

export async function getAdminOrders(_request, response) {
  const orders = await expirePendingOrders(await listOrders())
  return response.json({ orders })
}

export async function getAdminCustomers(_request, response) {
  const [users, orders] = await Promise.all([
    listUsers(),
    listCompletedOrders(),
  ])
  const customers = new Map(
    users.map((user) => [
      user.id,
      {
        id: user.id,
        name: user.name,
        phone: user.phone,
        orders: [],
      },
    ]),
  )

  for (const order of orders) {
    const fallbackId = `phone:${order.customer?.phone ?? order.id}`
    const customerId = order.user_id ?? fallbackId
    const customer = customers.get(customerId) ?? {
      id: customerId,
      name: order.customer?.name ?? 'Cliente',
      phone: order.customer?.phone ?? '',
      orders: [],
    }
    customer.orders.push(order)
    customers.set(customerId, customer)
  }

  const result = [...customers.values()]
    .map((customer) => ({
      ...customer,
      order_count: customer.orders.length,
      total_spent: customer.orders
        .reduce((total, order) => total + Number(order.total ?? 0), 0),
      last_order_at: customer.orders[0]?.created_at ?? null,
    }))
    .sort((first, second) =>
      String(second.last_order_at ?? '').localeCompare(String(first.last_order_at ?? '')),
    )

  return response.json({ customers: result })
}

export function getAdminOrderStream(request, response) {
  response.status(200)
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('X-Accel-Buffering', 'no')
  response.flushHeaders?.()
  response.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
  response.flush?.()

  const unsubscribe = subscribeToOrderChanges((event) => {
    response.write(`data: ${JSON.stringify(event)}\n\n`)
    response.flush?.()
  })
  const heartbeat = setInterval(() => {
    response.write(': heartbeat\n\n')
    response.flush?.()
  }, 15_000)

  request.on('close', () => {
    clearInterval(heartbeat)
    unsubscribe()
    response.end()
  })
}

export async function patchAdminOrderStatus(request, response) {
  const orderId = sanitizeText(request.params.id, 80)
  const restaurantStatus = sanitizeText(request.body?.status, 40)
  if (!allowedRestaurantStatuses.has(restaurantStatus)) {
    return response.status(400).json({ error: 'Etapa do pedido inválida.' })
  }

  const order = await findOrder(orderId)
  if (!order) {
    return response.status(404).json({ error: 'Pedido não encontrado.' })
  }

  const requiresPaymentBeforeProduction =
    order.payment_method !== 'cash-delivery' &&
    order.payment_method !== 'card-delivery' &&
    order.status !== 'paid'

  if (requiresPaymentBeforeProduction && restaurantStatus !== 'cancelled') {
    return response.status(409).json({
      error: 'O pedido precisa estar pago antes de avançar na produção.',
    })
  }

  const updated = await updateOrder(orderId, {
    restaurant_status: restaurantStatus,
  })
  return response.json({ order: updated })
}
