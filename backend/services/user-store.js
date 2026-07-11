import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { query, shouldUsePostgres } from './postgres.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.resolve(serviceDirectory, '../data/users.json')
let writeQueue = Promise.resolve()

function databaseFile() {
  return process.env.USERS_FILE
    ? path.resolve(process.env.USERS_FILE)
    : defaultFile
}

async function readDatabase() {
  try {
    const contents = await readFile(databaseFile(), 'utf8')
    const parsed = JSON.parse(contents)
    return Array.isArray(parsed.users) ? parsed : { users: [] }
  } catch (error) {
    if (error?.code === 'ENOENT') return { users: [] }
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

export async function findUserByPhone(phone) {
  if (shouldUsePostgres()) {
    const result = await query('select * from customers where phone = $1', [phone])
    return result.rows[0] ?? null
  }

  await writeQueue
  const database = await readDatabase()
  return database.users.find((user) => user.phone === phone) ?? null
}

export async function findUserById(userId) {
  if (shouldUsePostgres()) {
    const result = await query('select * from customers where id = $1', [userId])
    return result.rows[0] ?? null
  }

  await writeQueue
  const database = await readDatabase()
  return database.users.find((user) => user.id === userId) ?? null
}

export async function upsertPendingUser({ name, phone }) {
  if (shouldUsePostgres()) {
    const existing = await findUserByPhone(phone)
    if (existing?.verified) return existing

    const userId = existing?.id ?? randomUUID()
    const result = await query(
      `
        insert into customers (id, name, phone, verified)
        values ($1, $2, $3, false)
        on conflict (phone) do update set
          name = excluded.name,
          updated_at = now()
        returning *
      `,
      [userId, name, phone],
    )
    return result.rows[0]
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const existingIndex = database.users.findIndex((user) => user.phone === phone)
    const now = new Date().toISOString()

    if (existingIndex >= 0) {
      const existing = database.users[existingIndex]
      if (!existing.verified) {
        database.users[existingIndex] = {
          ...existing,
          name,
          updated_at: now,
        }
        await writeDatabase(database)
      }
      return database.users[existingIndex]
    }

    const user = {
      id: randomUUID(),
      name,
      phone,
      verified: false,
      password_hash: null,
      password_salt: null,
      created_at: now,
      updated_at: now,
    }
    database.users.push(user)
    await writeDatabase(database)
    return user
  })
}

export async function upsertVerifiedUser({ name, phone }) {
  if (shouldUsePostgres()) {
    const result = await query(
      `
        insert into customers (id, name, phone, verified, verified_at)
        values ($1, $2, $3, true, now())
        on conflict (phone) do update set
          name = excluded.name,
          verified = true,
          verified_at = coalesce(customers.verified_at, now()),
          updated_at = now()
        returning *
      `,
      [randomUUID(), name, phone],
    )
    return result.rows[0]
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const existingIndex = database.users.findIndex((user) => user.phone === phone)
    const now = new Date().toISOString()

    if (existingIndex >= 0) {
      const existing = database.users[existingIndex]
      database.users[existingIndex] = {
        ...existing,
        name,
        verified: true,
        verified_at: existing.verified_at ?? now,
        updated_at: now,
      }
      await writeDatabase(database)
      return database.users[existingIndex]
    }

    const user = {
      id: randomUUID(),
      name,
      phone,
      verified: true,
      verified_at: now,
      password_hash: null,
      password_salt: null,
      created_at: now,
      updated_at: now,
    }
    database.users.push(user)
    await writeDatabase(database)
    return user
  })
}

export async function updateUser(userId, changes) {
  if (shouldUsePostgres()) {
    const allowedChanges = [
      'name',
      'verified',
      'verified_at',
      'password_hash',
      'password_salt',
    ]
    const entries = Object.entries(changes).filter(([key]) =>
      allowedChanges.includes(key),
    )
    if (!entries.length) return findUserById(userId)

    const assignments = entries.map(
      ([key], index) => `${key} = $${index + 2}`,
    )
    const result = await query(
      `
        update customers
        set ${assignments.join(', ')}, updated_at = now()
        where id = $1
        returning *
      `,
      [userId, ...entries.map(([, value]) => value)],
    )
    return result.rows[0] ?? null
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const index = database.users.findIndex((user) => user.id === userId)
    if (index === -1) return null

    database.users[index] = {
      ...database.users[index],
      ...changes,
      updated_at: new Date().toISOString(),
    }
    await writeDatabase(database)
    return database.users[index]
  })
}

export async function resetUsersForTests() {
  if (shouldUsePostgres()) {
    await query('delete from customers')
    return
  }

  return serializedWrite(() => writeDatabase({ users: [] }))
}
