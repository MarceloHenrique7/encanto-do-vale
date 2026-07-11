import { updateOrder } from './order-store.js'

const defaultExpirationMinutes = 60

function expirationMinutes() {
  const configured = Number.parseInt(
    process.env.PIX_PENDING_EXPIRATION_MINUTES ?? '',
    10,
  )
  return Number.isFinite(configured) && configured > 0
    ? configured
    : defaultExpirationMinutes
}

function isPendingOnlineOrder(order) {
  return (
    order?.payment_method === 'online' &&
    (order.status === 'pending' || order.status === 'waiting_payment') &&
    order.restaurant_status === 'awaiting_payment'
  )
}

export function isExpiredPendingOrder(order, now = new Date()) {
  if (!isPendingOnlineOrder(order)) return false

  const createdAt = new Date(order.created_at).getTime()
  if (!Number.isFinite(createdAt)) return false

  const expiresAt = createdAt + expirationMinutes() * 60_000
  return expiresAt <= now.getTime()
}

export async function expirePendingOrder(order, now = new Date()) {
  if (!isExpiredPendingOrder(order, now)) return order

  return updateOrder(order.id, {
    status: 'failed',
    restaurant_status: 'cancelled',
    payment_status: 'expired',
    status_detail: 'expired_pix',
  })
}

export async function expirePendingOrders(orders, now = new Date()) {
  return Promise.all(
    orders.map((order) => expirePendingOrder(order, now)),
  )
}
