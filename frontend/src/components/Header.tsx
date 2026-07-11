import { FiMapPin, FiShoppingBag, FiUser } from 'react-icons/fi'

import { storeConfig } from '@/config/store'
import { formatCurrency } from '@/lib/formatters'
import { getStoreHoursStatus } from '@/lib/storeHours'

type HeaderProps = {
  cartCount: number
  cartTotal: number
  onOpenCart: () => void
  customerName?: string
  onOpenProfile: () => void
}

export default function Header({
  cartCount,
  cartTotal,
  onOpenCart,
  customerName,
  onOpenProfile,
}: HeaderProps) {
  const firstName = customerName?.split(' ')[0]
  const hoursStatus = getStoreHoursStatus()

  return (
    <header className="site-header">
      <nav className="topbar">
        <a className="brand" href="#cardapio" aria-label={`${storeConfig.name} - inicio`}>
          <span className="brand-mark">
            <img src={storeConfig.logoUrl} alt="" />
          </span>
          <span>
            {storeConfig.name}
            <small>
              <FiMapPin /> {storeConfig.city}
            </small>
          </span>
        </a>

        <div className="store-status">
          <span aria-hidden="true" />
          {hoursStatus.label}
        </div>

        <div className="header-customerActions">
          <button
            className="header-profile"
            type="button"
            onClick={onOpenProfile}
            aria-label={customerName ? 'Abrir meu perfil' : 'Entrar com telefone'}
          >
            <FiUser />
            <span>{firstName ? `Ola, ${firstName}` : 'Entrar'}</span>
          </button>
          <button
            className="header-cart"
            type="button"
            onClick={onOpenCart}
            aria-label={`Abrir carrinho com ${cartCount} itens`}
          >
            <FiShoppingBag />
            <span>
              <small>
                {cartCount ? `${cartCount} ${cartCount === 1 ? 'item' : 'itens'}` : 'Carrinho'}
              </small>
              <strong>{formatCurrency(cartTotal)}</strong>
            </span>
            {cartCount > 0 ? <b>{cartCount}</b> : null}
          </button>
        </div>
      </nav>
      <div className="mobile-store-status">
        <span aria-hidden="true" /> {hoursStatus.label} - Delivery
      </div>
    </header>
  )
}
