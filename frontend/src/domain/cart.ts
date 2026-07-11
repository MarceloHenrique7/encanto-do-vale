import type { CartItem, Product, ProductExtra } from '@/domain/catalog'

export type ResolvedCartItem = Product & {
  cartKey: string
  optionId?: string
  optionLabel?: string
  optionQuantityLabel?: string
  selectedExtras: ProductExtra[]
  unitPrice: number
  quantity: number
  subtotal: number
}

export function toCents(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100)
}

export function fromCents(value: number) {
  return value / 100
}

export function getCartItemKey(
  productId: string,
  optionId?: string,
  extras: string[] = [],
) {
  return [productId, optionId ?? 'default', ...[...extras].sort()].join(':')
}

export function isSameCartItem(
  item: CartItem,
  productId: string,
  optionId?: string,
  extras: string[] = [],
) {
  return (
    getCartItemKey(item.productId, item.optionId, item.extras) ===
    getCartItemKey(productId, optionId, extras)
  )
}

export function addCartItem(
  items: CartItem[],
  productId: string,
  optionId: string | undefined,
  quantity: number,
  extras: string[] = [],
) {
  const safeQuantity = Math.max(1, Math.trunc(quantity))
  const existingItem = items.find((item) =>
    isSameCartItem(item, productId, optionId, extras),
  )

  if (!existingItem) {
    return [...items, { productId, optionId, quantity: safeQuantity, extras }]
  }

  return items.map((item) =>
    isSameCartItem(item, productId, optionId, extras)
      ? { ...item, quantity: item.quantity + safeQuantity }
      : item,
  )
}

export function updateCartItemQuantity(
  items: CartItem[],
  productId: string,
  optionId: string | undefined,
  quantity: number,
  extras: string[] = [],
) {
  if (quantity <= 0) {
    return items.filter(
      (item) => !isSameCartItem(item, productId, optionId, extras),
    )
  }

  return items.map((item) =>
    isSameCartItem(item, productId, optionId, extras)
      ? { ...item, quantity: Math.trunc(quantity) }
      : item,
  )
}

export function resolveCartItems(
  items: CartItem[],
  products: Product[],
): ResolvedCartItem[] {
  return items.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId)

    if (!product || !product.isAvailable) {
      return []
    }

    const option = item.optionId
      ? product.options?.find((entry) => entry.id === item.optionId)
      : undefined
    const selectedExtras = (item.extras ?? []).flatMap((extraId) => {
      const extra = product.extras?.find((entry) => entry.id === extraId)
      return extra ? [extra] : []
    })
    const unitPriceInCents =
      toCents(option?.price ?? product.basePrice) +
      selectedExtras.reduce((total, extra) => total + toCents(extra.price), 0)
    const quantity = Math.max(1, Math.trunc(item.quantity))

    return [{
      ...product,
      cartKey: getCartItemKey(item.productId, item.optionId, item.extras),
      optionId: option?.id,
      optionLabel: option?.label,
      optionQuantityLabel: option?.quantityLabel,
      selectedExtras,
      unitPrice: fromCents(unitPriceInCents),
      quantity,
      subtotal: fromCents(unitPriceInCents * quantity),
    }]
  })
}

export function calculateCartSummary(items: ResolvedCartItem[]) {
  const subtotalInCents = items.reduce(
    (total, item) => total + toCents(item.unitPrice) * item.quantity,
    0,
  )

  return {
    count: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: fromCents(subtotalInCents),
  }
}
