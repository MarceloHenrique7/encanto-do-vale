import { useState } from 'react'

import CTA from '@/components/CTA'
import Cardapio from '@/components/Cardapio'
import FAQ from '@/components/FAQ'
import FloatingCart from '@/components/FloatingCart'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import { products } from '@/data/landing'
import type { CartItem } from '@/types/landing'
import HeaderCarousel from './components/HeaderCarousel'

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)

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
        cartItems={cartItems}
        isOpen={isCartOpen}
        onOpen={() => setIsCartOpen(true)}
        onClose={() => setIsCartOpen(false)}
        onUpdateQuantity={handleUpdateQuantity}
        whatsappPhone="5587988028002"
      />
      <Header />
      <Cardapio onAddToCart={handleAddToCart} />
      <HeaderCarousel />
    
      <Hero 
      heroImage="https://i.ibb.co/8gmdTx7N/Ovos-de-P-scoa-com-brigadeiro-e-morango.png"
      whatsappLink="https://wa.me/5587988028002?text=Ol%C3%A1!%20Quero%20fazer%20um%20pedido%20na%20Encanto%20do%20Vale."
      instagramLink="https://instagram.com/doceria.encantodovale"/>

      <main>
        <CTA />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
