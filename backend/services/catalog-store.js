import { readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { query, shouldUsePostgres } from './postgres.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.resolve(serviceDirectory, '../catalog.json')
const catalogKey = 'main'
let writeQueue = Promise.resolve()

function catalogFile() {
  return process.env.CATALOG_FILE
    ? path.resolve(process.env.CATALOG_FILE)
    : defaultFile
}

function emptyCatalog() {
  return { categories: [], products: [], extras: [] }
}

function normalizeDatabase(value) {
  const products = Array.isArray(value?.products) ? value.products : []
  const savedExtras = Array.isArray(value?.extras) ? value.extras : []
  const extrasById = new Map(savedExtras.map((extra) => [extra.id, extra]))
  products.forEach((product) => {
    product.extras?.forEach((extra) => {
      if (!extrasById.has(extra.id)) extrasById.set(extra.id, extra)
    })
  })
  return {
    categories: Array.isArray(value?.categories) ? value.categories : [],
    products,
    extras: [...extrasById.values()],
  }
}

function replaceExtraInProducts(products, extraId, extra) {
  return products.map((product) => {
    if (!product.extras?.some((item) => item.id === extraId)) return product
    return {
      ...product,
      extras: product.extras.map((item) => item.id === extraId ? extra : item),
      extraGroups: product.extraGroups?.map((group) => ({
        ...group,
        extraIds: group.extraIds.map((id) => id === extraId ? extra.id : id),
      })),
    }
  })
}

function syncProductExtras(catalog, product) {
  product.extras?.forEach((extra) => {
    const index = catalog.extras.findIndex((item) => item.id === extra.id)
    if (index === -1) catalog.extras.push(extra)
    else catalog.extras[index] = extra
    catalog.products = replaceExtraInProducts(catalog.products, extra.id, extra)
  })
}

export function getCatalogSnapshot() {
  try {
    return normalizeDatabase(JSON.parse(readFileSync(catalogFile(), 'utf8')))
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyCatalog()
    throw error
  }
}

async function readCatalog() {
  if (shouldUsePostgres()) {
    const result = await query(
      'select data from catalog_state where key = $1',
      [catalogKey],
    )
    if (result.rows[0]?.data) return normalizeDatabase(result.rows[0].data)

    const seededCatalog = getCatalogSnapshot()
    await writeCatalog(seededCatalog)
    return seededCatalog
  }

  try {
    return normalizeDatabase(JSON.parse(await readFile(catalogFile(), 'utf8')))
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyCatalog()
    throw error
  }
}

async function writeCatalog(catalog) {
  if (shouldUsePostgres()) {
    await query(
      `
        insert into catalog_state (key, data, updated_at)
        values ($1, $2::jsonb, now())
        on conflict (key)
        do update set data = excluded.data, updated_at = now()
      `,
      [catalogKey, JSON.stringify(normalizeDatabase(catalog))],
    )
    return
  }

  const file = catalogFile()
  const temporaryFile = `${file}.${process.pid}.tmp`
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(temporaryFile, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  await rename(temporaryFile, file)
}

function serializedWrite(operation) {
  const next = writeQueue.then(operation, operation)
  writeQueue = next.catch(() => {})
  return next
}

export async function getCatalog() {
  await writeQueue
  return readCatalog()
}

export async function createProduct(product) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    if (catalog.products.some((item) => item.id === product.id)) return null
    syncProductExtras(catalog, product)
    catalog.products.unshift(product)
    await writeCatalog(catalog)
    return product
  })
}

export async function updateProduct(productId, product) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    const index = catalog.products.findIndex((item) => item.id === productId)
    if (index === -1) return null
    if (
      product.id !== productId &&
      catalog.products.some((item) => item.id === product.id)
    ) {
      return false
    }
    syncProductExtras(catalog, product)
    catalog.products[index] = product
    await writeCatalog(catalog)
    return product
  })
}

export async function createExtra(extra) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    if (catalog.extras.some((item) => item.id === extra.id)) return null
    catalog.extras.push(extra)
    await writeCatalog(catalog)
    return extra
  })
}

export async function updateExtra(extraId, extra) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    const index = catalog.extras.findIndex((item) => item.id === extraId)
    if (index === -1) return null
    if (extra.id !== extraId && catalog.extras.some((item) => item.id === extra.id)) {
      return false
    }
    catalog.extras[index] = extra
    catalog.products = replaceExtraInProducts(catalog.products, extraId, extra)
    await writeCatalog(catalog)
    return extra
  })
}

export async function deleteExtra(extraId) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    const index = catalog.extras.findIndex((item) => item.id === extraId)
    if (index === -1) return false
    catalog.extras.splice(index, 1)
    catalog.products = catalog.products.map((product) => ({
      ...product,
      ...(product.extras
        ? { extras: product.extras.filter((extra) => extra.id !== extraId) }
        : {}),
      ...(product.extraGroups
        ? {
            extraGroups: product.extraGroups.flatMap((group) => {
              const extraIds = group.extraIds.filter((id) => id !== extraId)
              if (!extraIds.length) return []
              return [{
                ...group,
                extraIds,
                maxSelections: Math.min(group.maxSelections, extraIds.length),
              }]
            }),
          }
        : {}),
    }))
    await writeCatalog(catalog)
    return true
  })
}

export async function deleteProduct(productId) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    const index = catalog.products.findIndex((item) => item.id === productId)
    if (index === -1) return false
    catalog.products.splice(index, 1)
    await writeCatalog(catalog)
    return true
  })
}

export async function createCategory(category) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    if (catalog.categories.some((item) => item.id === category.id)) return null
    catalog.categories.push(category)
    await writeCatalog(catalog)
    return category
  })
}

export async function updateCategory(categoryId, category) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    const index = catalog.categories.findIndex((item) => item.id === categoryId)
    if (index === -1) return null
    const previousCategory = catalog.categories[index]
    if (
      category.id !== categoryId &&
      catalog.categories.some((item) => item.id === category.id)
    ) {
      return false
    }
    catalog.categories[index] = category
    if (category.id !== categoryId) {
      catalog.products = catalog.products.map((product) => ({
        ...product,
        categoryIds: product.categoryIds.map((id) =>
          id === categoryId ? category.id : id,
        ),
        primaryCategoryLabel:
          product.primaryCategoryLabel ===
          previousCategory.name
            ? category.name
            : product.primaryCategoryLabel,
      }))
    }
    await writeCatalog(catalog)
    return category
  })
}

export async function deleteCategory(categoryId) {
  return serializedWrite(async () => {
    const catalog = await readCatalog()
    if (
      catalog.products.some((product) =>
        product.categoryIds.includes(categoryId),
      )
    ) {
      return 'in-use'
    }
    const index = catalog.categories.findIndex((item) => item.id === categoryId)
    if (index === -1) return false
    catalog.categories.splice(index, 1)
    await writeCatalog(catalog)
    return true
  })
}
