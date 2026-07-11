import { readFileSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.resolve(serviceDirectory, '../catalog.json')
let writeQueue = Promise.resolve()

function catalogFile() {
  return process.env.CATALOG_FILE
    ? path.resolve(process.env.CATALOG_FILE)
    : defaultFile
}

function emptyCatalog() {
  return { categories: [], products: [] }
}

function normalizeDatabase(value) {
  return {
    categories: Array.isArray(value?.categories) ? value.categories : [],
    products: Array.isArray(value?.products) ? value.products : [],
  }
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
  try {
    return normalizeDatabase(JSON.parse(await readFile(catalogFile(), 'utf8')))
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyCatalog()
    throw error
  }
}

async function writeCatalog(catalog) {
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
    catalog.products[index] = product
    await writeCatalog(catalog)
    return product
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
