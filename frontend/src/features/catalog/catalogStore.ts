import { useEffect, useState } from 'react'

import {
  categories as publishedCategories,
  products as publishedProducts,
} from '@/data/catalog'
import type { Product, Category, PromotionCard } from '@/domain/catalog'

export const ADMIN_PRODUCTS_UPDATED_EVENT = 'encanto-admin-products-updated'
export const ADMIN_CATEGORIES_UPDATED_EVENT = 'encanto-admin-categories-updated'
let runtimeProducts: Product[] = publishedProducts
let runtimeCategories: Category[] = publishedCategories
let runtimePromotions: PromotionCard[] = []
let catalogRequest: Promise<void> | null = null

export async function refreshCatalog() {
  if (catalogRequest) return catalogRequest
  catalogRequest = fetch('/api/catalog', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error('CATALOG_REQUEST_FAILED')
      const data = await response.json()
      if (
        !Array.isArray(data.products) ||
        !data.products.every(isProduct) ||
        !Array.isArray(data.categories) ||
        !data.categories.every(isCategory) ||
        (data.promotions !== undefined &&
          (!Array.isArray(data.promotions) ||
            !data.promotions.every(isPromotion)))
      ) {
        throw new Error('INVALID_CATALOG')
      }
      runtimeProducts = data.products
      runtimeCategories = data.categories
      runtimePromotions = data.promotions ?? []
      window.dispatchEvent(new Event(ADMIN_PRODUCTS_UPDATED_EVENT))
      window.dispatchEvent(new Event(ADMIN_CATEGORIES_UPDATED_EVENT))
    })
    .catch(() => {
      // Mantém o catálogo publicado como contingência se a API estiver indisponível.
    })
    .finally(() => {
      catalogRequest = null
    })
  return catalogRequest
}

function isCategory(value: unknown): value is Category {
  if (!value || typeof value !== 'object') {
    return false
  }

  const category = value as Partial<Category>
  return (
    typeof category.id === 'string' &&
    typeof category.name === 'string' &&
    typeof category.shortLabel === 'string'
  )
}

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
    Number.isFinite(product.basePrice) &&
    product.basePrice > 0 &&
    typeof product.imageSrc === 'string' &&
    (product.fulfillmentType === 'encomenda' ||
      product.fulfillmentType === 'entrega-pronta') &&
    typeof product.isAvailable === 'boolean' &&
    typeof product.isFeatured === 'boolean' &&
    typeof product.isPromo === 'boolean' &&
    typeof product.primaryCategoryLabel === 'string' &&
    Array.isArray(product.categoryIds) &&
    product.categoryIds.every((categoryId) => typeof categoryId === 'string')
  )
}

function isPromotion(value: unknown): value is PromotionCard {
  if (!value || typeof value !== 'object') return false
  const promotion = value as Partial<PromotionCard>
  return (
    typeof promotion.id === 'string' &&
    typeof promotion.eyebrow === 'string' &&
    typeof promotion.title === 'string' &&
    typeof promotion.subtitle === 'string' &&
    typeof promotion.ctaLabel === 'string' &&
    typeof promotion.imageSrc === 'string' &&
    typeof promotion.productId === 'string' &&
    ['dark', 'rose', 'cream'].includes(promotion.tone ?? '') &&
    typeof promotion.isActive === 'boolean'
  )
}

export function getCatalogProducts() {
  return runtimeProducts
}

export function getCatalogCategories() {
  return runtimeCategories
}

export function getCatalogPromotions() {
  return runtimePromotions
}

export function useCatalogProducts() {
  const [products, setProducts] = useState<Product[]>(() => getCatalogProducts())

  useEffect(() => {
    function syncProducts() {
      setProducts(getCatalogProducts())
    }

    window.addEventListener(ADMIN_PRODUCTS_UPDATED_EVENT, syncProducts)
    refreshCatalog()

    return () => {
      window.removeEventListener(ADMIN_PRODUCTS_UPDATED_EVENT, syncProducts)
    }
  }, [])

  return products
}

export function useCatalogCategories() {
  const [categories, setCategories] = useState<Category[]>(() => getCatalogCategories())

  useEffect(() => {
    function syncCategories() {
      setCategories(getCatalogCategories())
    }

    window.addEventListener(ADMIN_CATEGORIES_UPDATED_EVENT, syncCategories)
    refreshCatalog()

    return () => {
      window.removeEventListener(ADMIN_CATEGORIES_UPDATED_EVENT, syncCategories)
    }
  }, [])

  return categories
}

export function useCatalogPromotions() {
  const [promotions, setPromotions] = useState<PromotionCard[]>(
    () => getCatalogPromotions(),
  )

  useEffect(() => {
    function syncPromotions() {
      setPromotions(getCatalogPromotions())
    }
    window.addEventListener(ADMIN_PRODUCTS_UPDATED_EVENT, syncPromotions)
    refreshCatalog()
    return () => {
      window.removeEventListener(ADMIN_PRODUCTS_UPDATED_EVENT, syncPromotions)
    }
  }, [])

  return promotions
}
