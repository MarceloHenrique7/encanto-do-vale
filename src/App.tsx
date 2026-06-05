import { useState } from 'react'

import AdminPage from '@/components/AdminPage'
import Cardapio from '@/components/Cardapio'
import FloatingCart from '@/components/FloatingCart'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import type { CartItem } from '@/types/landing'
import { useCatalogProducts } from '@/utils/adminCatalog'

export default function App() {
  const products = useCatalogProducts()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)
  const isAdminPage = window.location.pathname === '/admin'

  if (isAdminPage) {
    return <AdminPage />
  }

  function handleAddToCart(
    productId: string,
    optionId: string | undefined,
    quantity: number,
  ) {
    const product = products.find((item) => item.id === productId)
    const normalizedQuantity = Math.max(1, quantity)

    if (!product || !product.isAvailable) {
      return
    }

    if (optionId && !product.options?.some((option) => option.id === optionId)) {
      return
    }

    setCartItems((current) => {
      const existing = current.find(
        (item) => item.productId === productId && item.optionId === optionId,
      )

      if (existing) {
        return current.map((item) =>
          item.productId === productId && item.optionId === optionId
            ? { ...item, quantity: item.quantity + normalizedQuantity }
            : item,
        )
      }

      return [...current, { productId, optionId, quantity: normalizedQuantity }]
    })

    setIsCartOpen(true)
  }

  function handleUpdateQuantity(
    productId: string,
    optionId: string | undefined,
    nextQuantity: number,
  ) {
    setCartItems((current) => {
      if (nextQuantity <= 0) {
        return current.filter(
          (item) => !(item.productId === productId && item.optionId === optionId),
        )
      }

      return current.map((item) =>
        item.productId === productId && item.optionId === optionId
          ? { ...item, quantity: nextQuantity }
          : item,
      )
    })
  }

  return (
    <div className="page-shell">
      <FloatingCart
        products={products}
        cartItems={cartItems}
        isOpen={isCartOpen}
        onOpen={() => setIsCartOpen(true)}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateQuantity}
        whatsappPhone="5587988028002"
      />
      <Header />
      <Cardapio products={products} onAddToCart={handleAddToCart} />
      <Footer />
    </div>
  )
}
