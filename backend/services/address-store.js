import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { query, shouldUsePostgres } from './postgres.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.resolve(serviceDirectory, '../data/addresses.json')
let writeQueue = Promise.resolve()

function databaseFile() {
  return process.env.ADDRESSES_FILE
    ? path.resolve(process.env.ADDRESSES_FILE)
    : defaultFile
}

async function readDatabase() {
  try {
    const contents = await readFile(databaseFile(), 'utf8')
    const parsed = JSON.parse(contents)
    return Array.isArray(parsed.addresses) ? parsed : { addresses: [] }
  } catch (error) {
    if (error?.code === 'ENOENT') return { addresses: [] }
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

function fingerprint(address) {
  return createHash('sha256')
    .update([
      address.address,
      address.number,
      address.neighborhood,
      address.complement,
    ].map((value) => String(value).trim().toLocaleLowerCase('pt-BR')).join('|'))
    .digest('hex')
}

function publicAddress(row) {
  return {
    id: row.id,
    label: row.label,
    recipientName: row.recipient_name ?? row.recipientName,
    phone: row.phone,
    address: row.address,
    number: row.number,
    neighborhood: row.neighborhood,
    complement: row.complement ?? '',
    isDefault: row.is_default ?? row.isDefault ?? false,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
  }
}

export async function listCustomerAddresses(customerId) {
  if (shouldUsePostgres()) {
    const result = await query(
      `select * from customer_addresses
       where customer_id = $1
       order by is_default desc, updated_at desc
       limit 10`,
      [customerId],
    )
    return result.rows.map(publicAddress)
  }
  await writeQueue
  const database = await readDatabase()
  return database.addresses
    .filter((item) => item.customerId === customerId)
    .sort((a, b) =>
      Number(b.isDefault) - Number(a.isDefault) ||
      String(b.updatedAt).localeCompare(String(a.updatedAt)),
    )
    .slice(0, 10)
    .map(publicAddress)
}

export async function upsertCustomerAddress(customerId, address) {
  const addressFingerprint = fingerprint(address)
  if (shouldUsePostgres()) {
    const result = await query(
      `with existing_count as (
         select count(*)::int as count
         from customer_addresses
         where customer_id = $1
       )
       insert into customer_addresses
         (id,customer_id,label,recipient_name,phone,address,number,
          neighborhood,complement,fingerprint,is_default)
       select $2,$1,$3,$4,$5,$6,$7,$8,$9,$10,(count = 0)
       from existing_count
       where count < 10 or exists (
         select 1 from customer_addresses
         where customer_id = $1 and fingerprint = $10
       )
       on conflict (customer_id, fingerprint) do update set
         label = excluded.label,
         recipient_name = excluded.recipient_name,
         phone = excluded.phone,
         address = excluded.address,
         number = excluded.number,
         neighborhood = excluded.neighborhood,
         complement = excluded.complement,
         updated_at = now()
       returning *`,
      [
        customerId,
        randomUUID(),
        address.label,
        address.recipientName,
        address.phone,
        address.address,
        address.number,
        address.neighborhood,
        address.complement,
        addressFingerprint,
      ],
    )
    return result.rows[0] ? publicAddress(result.rows[0]) : null
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const now = new Date().toISOString()
    let saved = database.addresses.find(
      (item) =>
        item.customerId === customerId &&
        item.fingerprint === addressFingerprint,
    )
    if (saved) {
      Object.assign(saved, address, { fingerprint: addressFingerprint, updatedAt: now })
    } else {
      const customerAddressCount = database.addresses.filter(
        (item) => item.customerId === customerId,
      ).length
      if (customerAddressCount >= 10) return null
      const hasAddress = database.addresses.some(
        (item) => item.customerId === customerId,
      )
      saved = {
        id: randomUUID(),
        customerId,
        ...address,
        fingerprint: addressFingerprint,
        isDefault: !hasAddress,
        createdAt: now,
        updatedAt: now,
      }
      database.addresses.push(saved)
    }
    await writeDatabase(database)
    return publicAddress(saved)
  })
}

export async function deleteCustomerAddress(customerId, addressId) {
  if (shouldUsePostgres()) {
    const result = await query(
      `delete from customer_addresses
       where id = $1 and customer_id = $2
       returning is_default`,
      [addressId, customerId],
    )
    if (!result.rowCount) return false
    if (result.rows[0].is_default) {
      await query(
        `update customer_addresses
         set is_default = true, updated_at = now()
         where id = (
           select id from customer_addresses
           where customer_id = $1
           order by updated_at desc limit 1
         )`,
        [customerId],
      )
    }
    return true
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const index = database.addresses.findIndex(
      (item) => item.id === addressId && item.customerId === customerId,
    )
    if (index < 0) return false
    const [removed] = database.addresses.splice(index, 1)
    if (removed.isDefault) {
      const next = database.addresses.find((item) => item.customerId === customerId)
      if (next) next.isDefault = true
    }
    await writeDatabase(database)
    return true
  })
}

export async function resetAddressesForTests() {
  if (shouldUsePostgres()) {
    await query('delete from customer_addresses')
    return
  }
  return serializedWrite(() => writeDatabase({ addresses: [] }))
}
