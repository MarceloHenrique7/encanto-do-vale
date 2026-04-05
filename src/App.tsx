import { useState } from 'react'

import CTA from '@/components/CTA'
import Cardapio from '@/components/Cardapio'
import FAQ from '@/components/FAQ'
import FloatingCart from '@/components/FloatingCart'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import Hero from '@/components/Hero'
import type { CartItem } from '@/types/landing'

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [isCartOpen, setIsCartOpen] = useState(false)

  function handleAddToCart(productId: string) {
    setCartItems((current) => {
      const existing = current.find((item) => item.productId === productId)

      if (existing) {
        return current.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }

      return [...current, { productId, quantity: 1 }]
    })

    setIsCartOpen(true)
  }

  function handleUpdateQuantity(productId: string, nextQuantity: number) {
    setCartItems((current) => {
      if (nextQuantity <= 0) {
        return current.filter((item) => item.productId !== productId)
      }

      return current.map((item) =>
        item.productId === productId
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
      <Hero 
      heroImage="https://i.ibb.co/8gmdTx7N/Ovos-de-P-scoa-com-brigadeiro-e-morango.png"
      whatsappLink="https://wa.me/5587988028002?text=Ol%C3%A1!%20Quero%20fazer%20um%20pedido%20na%20Encanto%20do%20Vale."
      instagramLink="https://instagram.com/encantodovale"/>

      <main>
        <Cardapio onAddToCart={handleAddToCart} />
        <CTA />
        <FAQ />
      </main>
      <Footer />
    </div>
  )
}
