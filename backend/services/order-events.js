import { EventEmitter } from 'node:events'

const orderEvents = new EventEmitter()
orderEvents.setMaxListeners(100)

export function notifyOrderChange(order) {
  orderEvents.emit('order-change', {
    order_id: order.id,
    status: order.status,
    restaurant_status: order.restaurant_status,
    updated_at: order.updated_at,
  })
}

export function subscribeToOrderChanges(listener) {
  orderEvents.on('order-change', listener)
  return () => orderEvents.off('order-change', listener)
}
