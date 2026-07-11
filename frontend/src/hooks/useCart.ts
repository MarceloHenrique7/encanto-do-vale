import { useMemo, useState } from 'react'

import {
  addCartItem,
  calculateCartSummary,
  resolveCartItems,
  updateCartItemQuantity,
} from '@/domain/cart'
import type { CartItem, Product } from '@/domain/catalog'

export function useCart(products: Product[]) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const resolvedItems = useMemo(
    () => resolveCartItems(items, products),
    [items, products],
  )
  const summary = useMemo(
    () => calculateCartSummary(resolvedItems),
    [resolvedItems],
  )

  function add(
    productId: string,
    optionId: string | undefined,
    quantity: number,
    extras: string[] = [],
  ) {
    const product = products.find((entry) => entry.id === productId)
    const normalizedExtras = [...new Set(extras ?? [])]
    const normalizedQuantity = Number.isFinite(quantity)
      ? Math.max(1, Math.trunc(quantity))
      : 1

    if (
      !product?.isAvailable ||
      (product.options?.length && !optionId) ||
      (optionId && !product.options?.some((option) => option.id === optionId)) ||
      normalizedExtras.some(
        (extraId) => !product.extras?.some((extra) => extra.id === extraId),
      )
    ) {
      return false
    }

    setItems((current) =>
      addCartItem(
        current,
        productId,
        optionId,
        normalizedQuantity,
        normalizedExtras,
      ),
    )
    setIsOpen(true)
    return true
  }

  function updateQuantity(
    productId: string,
    optionId: string | undefined,
    quantity: number,
    extras: string[] = [],
  ) {
    setItems((current) =>
      updateCartItemQuantity(current, productId, optionId, quantity, extras),
    )
  }

  return {
    items,
    resolvedItems,
    isOpen,
    count: summary.count,
    subtotal: summary.subtotal,
    add,
    updateQuantity,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  }
}
