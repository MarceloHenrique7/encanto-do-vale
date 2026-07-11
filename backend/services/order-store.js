import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { notifyOrderChange } from './order-events.js'
import { query, shouldUsePostgres } from './postgres.js'

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

export async function listOrders() {
  if (shouldUsePostgres()) {
    const result = await query(
      'select order_data from orders order by created_at desc',
    )
    return result.rows.map((row) => row.order_data)
  }

  await writeQueue
  const database = await readDatabase()
  return [...database.orders].sort(
    (first, second) =>
      new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
  )
}

export async function listCustomerOrders(userId, limit = 20) {
  if (shouldUsePostgres()) {
    const result = await query(
      `
        select order_data
        from orders
        where user_id = $1
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
    .filter((order) => order.user_id === userId)
    .sort(
      (first, second) =>
        new Date(second.created_at).getTime() -
        new Date(first.created_at).getTime(),
    )
    .slice(0, limit)
}

export async function updateOrder(orderId, changes) {
  if (shouldUsePostgres()) {
    const existing = await findOrder(orderId)
    if (!existing) return null

    const updated = {
      ...existing,
      ...changes,
      updated_at: new Date().toISOString(),
    }

    await query(
      `
        update orders
        set
          user_id = $2,
          status = $3,
          restaurant_status = $4,
          payment_status = $5,
          payment_method = $6,
          payment_id = $7,
          status_detail = $8,
          payment_attempts = $9,
          order_data = $10::jsonb,
          updated_at = $11
        where id = $1
      `,
      [
        orderId,
        updated.user_id,
        updated.status,
        updated.restaurant_status ?? null,
        updated.payment_status ?? null,
        updated.payment_method ?? null,
        updated.payment_id ?? null,
        updated.status_detail ?? null,
        updated.payment_attempts ?? 0,
        JSON.stringify(updated),
        updated.updated_at,
      ],
    )
    notifyOrderChange(updated)
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
    return database.orders[index]
  })
}

export async function resetOrdersForTests() {
  if (shouldUsePostgres()) {
    await query('delete from orders')
    return
  }

  return serializedWrite(() => writeDatabase({ orders: [] }))
}
