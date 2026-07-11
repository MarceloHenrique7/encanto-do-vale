import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const sourcePath = resolve('backend/catalog.json')
const fallbackPath = resolve('frontend/src/data/catalog.ts')
const catalog = JSON.parse(await readFile(sourcePath, 'utf8'))

if (!Array.isArray(catalog.categories) || !Array.isArray(catalog.products)) {
  throw new Error('backend/catalog.json precisa conter categories e products.')
}

const invalidProduct = catalog.products.find(
  (product) =>
    !product?.id ||
    !product?.name ||
    !Number.isFinite(product?.basePrice) ||
    product.basePrice <= 0 ||
    !Array.isArray(product?.categoryIds),
)
if (invalidProduct) {
  throw new Error(`Produto inválido no catálogo: ${invalidProduct.id ?? 'sem ID'}`)
}

if (process.argv.includes('--check')) {
  console.log(`Catálogo válido: ${catalog.products.length} produtos.`)
} else {
  const source = `import type { Category, Product } from '@/domain/catalog'

// Snapshot de contingência. A fonte principal é backend/catalog.json via /api/catalog.
export const categories: Category[] = ${JSON.stringify(catalog.categories, null, 2)}

export const products: Product[] = ${JSON.stringify(catalog.products, null, 2)}
`
  await writeFile(fallbackPath, source, 'utf8')
  console.log(
    `Fallback do frontend atualizado em ${pathToFileURL(fallbackPath)} (${catalog.products.length} produtos).`,
  )
}
