import { useEffect, useState } from 'react'
import { FiAward, FiMapPin, FiShoppingBag, FiUser } from 'react-icons/fi'

import { storeConfig } from '@/config/store'
import { formatCurrency } from '@/lib/formatters'
import { getStoreHoursStatus } from '@/lib/storeHours'
import { useStoreSettings } from '@/features/settings/storeSettingsStore'

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
  const settings = useStoreSettings()
  const hoursStatus = getStoreHoursStatus(new Date(), settings.weeklyHours)
  const [points, setPoints] = useState<number | null>(null)

  useEffect(() => {
    if (!customerName) {
      setPoints(null)
      return
    }
    fetch('/api/loyalty')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setPoints(data?.account?.currentBalance ?? null))
      .catch(() => setPoints(null))
  }, [customerName])

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
            <span>{firstName ? `Olá, ${firstName}` : 'Entrar'}</span>
            {points !== null ? <b className="header-points"><FiAward /> {points}</b> : null}
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
