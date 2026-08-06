import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { notifyOrderChange } from './order-events.js'
import { query, shouldUsePostgres } from './postgres.js'
import { processOrderLoyalty } from './loyalty-store.js'
import {
  processCompletedOrderCampaigns,
  releaseCampaignCouponForOrder,
} from './campaign-store.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.resolve(serviceDirectory, '../data/orders.json')
let writeQueue = Promise.resolve()

function databaseFile() {
  return process.env.ORDERS_FILE
    ? path.resolve(process.env.ORDERS_FILE)
    : defaultFile
}

async function readDatabase() {
  try {
    const contents = await readFile(databaseFile(), 'utf8')
    const parsed = JSON.parse(contents)
    return Array.isArray(parsed.orders) ? parsed : { orders: [] }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return { orders: [] }
    }

    throw error
  }
}

async function writeDatabase(database) {
  const file = databaseFile()
  const temporaryFile = `${file}.${process.pid}.tmp`
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(temporaryFile, `${JSON.stringify(database, null, 2)}\n`, 'utf8')
  await rename(temporaryFile, file)
}

function serializedWrite(operation) {
  const next = writeQueue.then(operation, operation)
  writeQueue = next.catch(() => {})
  return next
}

export async function createOrder(order) {
  if (shouldUsePostgres()) {
    await query(
      `
        insert into orders (
          id,
          user_id,
          status,
          restaurant_status,
          payment_status,
          payment_method,
          payment_id,
          status_detail,
          payment_attempts,
          order_data,
          created_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
      `,
      [
        order.id,
        order.user_id,
        order.status,
        order.restaurant_status ?? null,
        order.payment_status ?? null,
        order.payment_method ?? null,
        order.payment_id ?? null,
        order.status_detail ?? null,
        order.payment_attempts ?? 0,
        JSON.stringify(order),
        order.created_at,
        order.updated_at,
      ],
    )
    notifyOrderChange(order)
    return order
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    database.orders.push(order)
    await writeDatabase(database)
    notifyOrderChange(order)
    return order
  })
}

export async function findOrder(orderId) {
  if (shouldUsePostgres()) {
    const result = await query('select order_data from orders where id = $1', [
      orderId,
    ])
    return result.rows[0]?.order_data ?? null
  }

  await writeQueue
  const database = await readDatabase()
  return database.orders.find((order) => order.id === orderId) ?? null
}

export async function listOrders(limit = 500) {
  if (shouldUsePostgres()) {
    const result = await query(
      'select order_data from orders order by created_at desc limit $1',
      [limit],
    )
    return result.rows.map((row) => row.order_data)
  }

  await writeQueue
  const database = await readDatabase()
  return [...database.orders].sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  ).slice(0, limit)
}

export async function listCompletedOrders() {
  if (shouldUsePostgres()) {
    const result = await query(
      `select order_data
       from orders
       where restaurant_status = 'completed'
       order by created_at desc`,
    )
    return result.rows.map((row) => row.order_data)
  }

  return (await listOrders()).filter(
    (order) => order.restaurant_status === 'completed',
  )
}

export async function listCustomerOrders(userId, limit = 20) {
  if (shouldUsePostgres()) {
    const result = await query(
      `
        select order_data
        from orders
        where user_id = $1
          and restaurant_status = 'completed'
        order by created_at desc
        limit $2
      `,
      [userId, limit],
    )
    return result.rows.map((row) => row.order_data)
  }

  await writeQueue
  const database = await readDatabase()
  return database.orders
    .filter(
      (order) =>
        order.user_id === userId && order.restaurant_status === 'completed',
    )
    .sort(
      (first, second) =>
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime(),
    )
    .slice(0, limit)
}

export async function updateOrder(orderId, changes) {
  if (shouldUsePostgres()) {
    const patch = {
      ...changes,
      updated_at: new Date().toISOString(),
    }
    const result = await query(
      `
        update orders
        set
          user_id = case
            when $2::jsonb ? 'user_id'
              then nullif($2::jsonb ->> 'user_id', '')::uuid
            else user_id
          end,
          status = case
            when $2::jsonb ? 'status' then $2::jsonb ->> 'status'
            else status
          end,
          restaurant_status = case
            when $2::jsonb ? 'restaurant_status'
              then $2::jsonb ->> 'restaurant_status'
            else restaurant_status
          end,
          payment_status = case
            when $2::jsonb ? 'payment_status'
              then $2::jsonb ->> 'payment_status'
            else payment_status
          end,
          payment_method = case
            when $2::jsonb ? 'payment_method'
              then $2::jsonb ->> 'payment_method'
            else payment_method
          end,
          payment_id = case
            when $2::jsonb ? 'payment_id' then $2::jsonb ->> 'payment_id'
            else payment_id
          end,
          status_detail = case
            when $2::jsonb ? 'status_detail'
              then $2::jsonb ->> 'status_detail'
            else status_detail
          end,
          payment_attempts = case
            when $2::jsonb ? 'payment_attempts'
              then ($2::jsonb ->> 'payment_attempts')::integer
            else payment_attempts
          end,
          order_data = order_data || $2::jsonb,
          updated_at = ($2::jsonb ->> 'updated_at')::timestamptz
        where id = $1
        returning order_data
      `,
      [orderId, JSON.stringify(patch)],
    )
    const updated = result.rows[0]?.order_data ?? null
    if (!updated) return null
    notifyOrderChange(updated)
    await processOrderLoyalty(updated)
    void processCompletedOrderCampaigns(updated).catch((error) => {
      console.error('Falha ao distribuir campanha do pedido', {
        orderId,
        message: error?.message,
      })
    })
    if (
      updated.status === 'failed' ||
      updated.restaurant_status === 'cancelled'
    ) {
      void releaseCampaignCouponForOrder(orderId).catch((error) => {
        console.error('Falha ao liberar cupom do pedido cancelado', {
          orderId,
          message: error?.message,
        })
      })
    }
    return updated
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const index = database.orders.findIndex((order) => order.id === orderId)

    if (index === -1) {
      return null
    }

    database.orders[index] = {
      ...database.orders[index],
      ...changes,
      updated_at: new Date().toISOString(),
    }
    await writeDatabase(database)
    notifyOrderChange(database.orders[index])
    await processOrderLoyalty(database.orders[index])
    void processCompletedOrderCampaigns(database.orders[index]).catch((error) => {
      console.error('Falha ao distribuir campanha do pedido', {
        orderId,
        message: error?.message,
      })
    })
    if (
      database.orders[index].status === 'failed' ||
      database.orders[index].restaurant_status === 'cancelled'
    ) {
      void releaseCampaignCouponForOrder(orderId).catch((error) => {
        console.error('Falha ao liberar cupom do pedido cancelado', {
          orderId,
          message: error?.message,
        })
      })
    }
    return database.orders[index]
  })
}

export async function incrementPaymentAttempts(orderId) {
  if (shouldUsePostgres()) {
    const updatedAt = new Date().toISOString()
    const result = await query(
      `
        update orders
        set
          payment_attempts = payment_attempts + 1,
          order_data = jsonb_set(
            jsonb_set(
              order_data,
              '{payment_attempts}',
              to_jsonb(payment_attempts + 1)
            ),
            '{updated_at}',
            to_jsonb($2::text)
          ),
          updated_at = $2::timestamptz
        where id = $1
        returning payment_attempts
      `,
      [orderId, updatedAt],
    )
    return result.rows[0]?.payment_attempts ?? null
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const order = database.orders.find((entry) => entry.id === orderId)
    if (!order) return null
    order.payment_attempts = (order.payment_attempts ?? 0) + 1
    order.updated_at = new Date().toISOString()
    await writeDatabase(database)
    return order.payment_attempts
  })
}

export async function resetOrdersForTests() {
  if (shouldUsePostgres()) {
    await query('delete from orders')
    return
  }

  return serializedWrite(() => writeDatabase({ orders: [] }))
}
