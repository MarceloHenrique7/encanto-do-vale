import { useEffect, useState } from 'react'
import { FiGift, FiMapPin, FiUser } from 'react-icons/fi'

import { storeConfig } from '@/config/store'
import { getStoreHoursStatus } from '@/lib/storeHours'
import { useStoreSettings } from '@/features/settings/storeSettingsStore'

type HeaderProps = {
  customerName?: string
  onOpenProfile: () => void
  onOpenRewards: () => void
}

export default function Header({
  customerName,
  onOpenProfile,
  onOpenRewards,
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
            className="header-rewards"
            type="button"
            onClick={onOpenRewards}
            aria-label={
              customerName
                ? `Abrir meus pontos e recompensas${points !== null ? `, saldo de ${points} pontos` : ''}`
                : 'Entrar para ver pontos e resgatar presentes'
            }
          >
            <FiGift />
            <span>
              <small>{customerName ? 'Recompensas' : 'Ganhe pontos'}</small>
              <strong>{points !== null ? `${points} pontos` : 'Presentes'}</strong>
            </span>
          </button>
          <button
            className="header-profile"
            type="button"
            onClick={onOpenProfile}
            aria-label={customerName ? 'Abrir meu perfil' : 'Entrar com telefone'}
          >
            <FiUser />
            <span>{firstName ? `Olá, ${firstName}` : 'Entrar'}</span>
          </button>
        </div>
      </nav>
      <div className="mobile-store-status">
        <span aria-hidden="true" /> {hoursStatus.label} - Delivery
      </div>
    </header>
  )
}
