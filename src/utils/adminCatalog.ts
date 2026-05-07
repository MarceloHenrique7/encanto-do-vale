import { useEffect, useState } from 'react'

import { products as landingProducts } from '@/data/landing'
import type { Product } from '@/types/landing'

export const ADMIN_PRODUCTS_STORAGE_KEY = 'encanto-do-vale-admin-products'
export const ADMIN_AUTH_STORAGE_KEY = 'encanto-do-vale-admin-auth'
export const ADMIN_PRODUCTS_UPDATED_EVENT = 'encanto-admin-products-updated'

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== 'object') {
    return false
  }

  const product = value as Partial<Product>

  return (
    typeof product.id === 'string' &&
    typeof product.name === 'string' &&
    typeof product.description === 'string' &&
    typeof product.price === 'string' &&
    typeof product.basePrice === 'number' &&
    typeof product.imageSrc === 'string' &&
    (product.fulfillmentType === 'encomenda' ||
      product.fulfillmentType === 'entrega-pronta') &&
    typeof product.isAvailable === 'boolean' &&
    typeof product.isFeatured === 'boolean' &&
    typeof product.isPromo === 'boolean' &&
    typeof product.primaryCategoryLabel === 'string' &&
    Array.isArray(product.categoryIds)
  )
}

export function getCatalogProducts() {
  if (typeof window === 'undefined') {
    return landingProducts
  }

  const stored = window.localStorage.getItem(ADMIN_PRODUCTS_STORAGE_KEY)

  if (!stored) {
    return landingProducts
  }

  try {
    const parsed = JSON.parse(stored)

    if (Array.isArray(parsed) && parsed.every(isProduct)) {
      return parsed
    }
  } catch {
    return landingProducts
  }

  return landingProducts
}

export function saveCatalogProducts(products: Product[]) {
  window.localStorage.setItem(
    ADMIN_PRODUCTS_STORAGE_KEY,
    JSON.stringify(products, null, 2),
  )
  window.dispatchEvent(new Event(ADMIN_PRODUCTS_UPDATED_EVENT))
}

export function resetCatalogProducts() {
  window.localStorage.removeItem(ADMIN_PRODUCTS_STORAGE_KEY)
  window.dispatchEvent(new Event(ADMIN_PRODUCTS_UPDATED_EVENT))
}

export function useCatalogProducts() {
  const [products, setProducts] = useState<Product[]>(() => getCatalogProducts())

  useEffect(() => {
    function syncProducts() {
      setProducts(getCatalogProducts())
    }

    window.addEventListener('storage', syncProducts)
    window.addEventListener(ADMIN_PRODUCTS_UPDATED_EVENT, syncProducts)

    return () => {
      window.removeEventListener('storage', syncProducts)
      window.removeEventListener(ADMIN_PRODUCTS_UPDATED_EVENT, syncProducts)
    }
  }, [])

  return products
}

export function buildLandingProductsSnippet(products: Product[]) {
  return `export const products: Product[] = ${JSON.stringify(products, null, 2)}`
}
