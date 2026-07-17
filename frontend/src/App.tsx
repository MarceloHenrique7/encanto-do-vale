import { lazy, Suspense, useMemo, useState } from 'react'
import { FiChevronRight, FiMapPin, FiShoppingBag } from 'react-icons/fi'

import Cardapio from '@/components/Cardapio'
import CustomerAuthGate, {
  type CustomerUser,
} from '@/components/CustomerAuthGate'
import FloatingCart from '@/components/FloatingCart'
import Footer from '@/components/Footer'
import Header from '@/components/Header'
import StoreHero from '@/components/StoreHero'
import { storeConfig } from '@/config/store'
import { useCatalogProducts } from '@/features/catalog/catalogStore'
import { useCart } from '@/hooks/useCart'
import { formatCurrency } from '@/lib/formatters'

const ManagerPage = lazy(() => import('@/components/ManagerPage'))
const CustomerProfile = lazy(() => import('@/components/CustomerProfile'))
const OrderStatusPage = lazy(() => import('@/components/OrderStatusPage'))
const PrivacyPage = lazy(() => import('@/components/PrivacyPage'))

const checkoutMessages = {
  success: {
    title: 'Pagamento aprovado',
    text: 'Recebemos o retorno do Mercado Pago. A loja vai confirmar preparo e entrega pelo WhatsApp.',
  },
  pending: {
    title: 'Pagamento em análise',
    text: 'Seu pagamento ficou pendente. Acompanhe no Mercado Pago e fale com a loja se precisar.',
  },
  failure: {
    title: 'Pagamento não concluído',
    text: 'Você pode tentar pagar novamente pelo carrinho.',
  },
} as const

type CheckoutStatus = keyof typeof checkoutMessages

function getCheckoutStatus(): CheckoutStatus | null {
  const status = new URLSearchParams(window.location.search).get('checkout')
  return status === 'success' || status === 'pending' || status === 'failure'
    ? status
    : null
}

function StoreExperience({
  user,
  onUserUpdate,
  onLoginRequest,
}: {
  user: CustomerUser | null
  onUserUpdate: (user: CustomerUser | null) => void
  onLoginRequest: () => void
}) {
  const orderPageMatch = window.location.pathname.match(/^\/pedido\/([^/]+)$/)
  const products = useCatalogProducts()
  const availableProducts = useMemo(
    () => products.filter((product) => product.isAvailable),
    [products],
  )
  const cart = useCart(availableProducts)
  const [checkoutStatus, setCheckoutStatus] = useState(getCheckoutStatus)
  const [profileOpen, setProfileOpen] = useState(false)

  if (orderPageMatch) {
    return (
      <Suspense fallback={<div className="route-loading">Abrindo pedido…</div>}>
        <OrderStatusPage orderId={decodeURIComponent(orderPageMatch[1])} />
      </Suspense>
    )
  }

  return (
    <div className="page-shell">
      {user && profileOpen ? (
        <Suspense fallback={null}>
          <CustomerProfile
            user={user}
            isOpen
            onClose={() => setProfileOpen(false)}
            onUpdate={onUserUpdate}
          />
        </Suspense>
      ) : null}
      <FloatingCart
        resolvedItems={cart.resolvedItems}
        isOpen={cart.isOpen}
        onOpen={cart.open}
        onClose={cart.close}
        onUpdateQuantity={cart.updateQuantity}
        whatsappPhone={storeConfig.whatsappPhone}
        customerAccount={user}
        onCustomerAccount={onUserUpdate}
        showTrigger={false}
      />
      <Header
        cartCount={cart.count}
        cartTotal={cart.subtotal}
        onOpenCart={cart.open}
        customerName={user?.name}
        onOpenProfile={() => {
          if (user) setProfileOpen(true)
          else onLoginRequest()
        }}
      />
      <StoreHero
        imageSrc={availableProducts.find((product) => product.isFeatured)?.imageSrc}
      />
      {checkoutStatus ? (
        <section
          className={`checkout-return checkout-return--${checkoutStatus}`}
          aria-live="polite"
        >
          <div>
            <strong>{checkoutMessages[checkoutStatus].title}</strong>
            <p>{checkoutMessages[checkoutStatus].text}</p>
          </div>
          <button type="button" onClick={() => setCheckoutStatus(null)}>
            Fechar
          </button>
        </section>
      ) : null}
      <div className="catalog-layout">
        <div className="catalog-main">
          <Cardapio products={availableProducts} onAddToCart={cart.add} />
        </div>
        <aside className="catalog-cartAside">
          <button
            type="button"
            className="catalog-deliveryCard"
            onClick={cart.open}
          >
            <FiMapPin />
            <span>
              <strong>Entrega delivery</strong>
              <small>Informe seu bairro no fechamento</small>
            </span>
            <FiChevronRight />
          </button>

          <div className="catalog-bagCard">
            <div className="catalog-bagTitle">
              <span>Sua sacola</span>
              {cart.count ? <b>{cart.count} itens</b> : null}
            </div>
            {cart.resolvedItems.length ? (
              <>
                <div className="catalog-bagItems">
                  {cart.resolvedItems.slice(0, 3).map((item) => (
                    <div key={item.cartKey}>
                      <span>{item.quantity}×</span>
                      <strong>{item.name}</strong>
                      <small>{formatCurrency(item.subtotal)}</small>
                    </div>
                  ))}
                </div>
                <div className="catalog-bagTotal">
                  <span>Subtotal</span>
                  <strong>{formatCurrency(cart.subtotal)}</strong>
                </div>
                <button type="button" onClick={cart.open}>
                  Continuar pedido
                </button>
              </>
            ) : (
              <div className="catalog-bagEmpty">
                <FiShoppingBag />
                <strong>Sacola vazia</strong>
                <p>Adicione seus doces favoritos para continuar.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
      <Footer />
    </div>
  )
}

export default function App() {
  const isAdminPage = window.location.pathname === '/admin'
  const isManagerPage = window.location.pathname === '/gestor'
  const isPrivacyPage = window.location.pathname === '/privacidade'
  if (isPrivacyPage) {
    return (
      <Suspense fallback={<div className="route-loading">Abrindo privacidade…</div>}>
        <PrivacyPage />
      </Suspense>
    )
  }

  if (isAdminPage) {
    window.location.replace('/gestor')
    return <div className="route-loading">Abrindo gestor…</div>
  }

  if (isManagerPage) {
    return (
      <Suspense fallback={<div className="route-loading">Abrindo gestor…</div>}>
        <ManagerPage />
      </Suspense>
    )
  }

  return (
    <CustomerAuthGate>
      {(user, updateUser, openLogin) => (
        <StoreExperience
          user={user}
          onUserUpdate={updateUser}
          onLoginRequest={openLogin}
        />
      )}
    </CustomerAuthGate>
  )
}
