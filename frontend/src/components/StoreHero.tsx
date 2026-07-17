import { FiClock, FiMapPin, FiPackage, FiTruck } from 'react-icons/fi'

import { storeConfig } from '@/config/store'
import { formatCurrency } from '@/lib/formatters'
import { getStoreHoursStatus } from '@/lib/storeHours'
import { useStoreSettings } from '@/features/settings/storeSettingsStore'

type StoreHeroProps = {
  imageSrc?: string
}

export default function StoreHero({ imageSrc }: StoreHeroProps) {
  const settings = useStoreSettings()
  const hoursStatus = getStoreHoursStatus(new Date(), settings.weeklyHours)

  return (
    <section className="store-hero" aria-labelledby="store-title">
      <div className="store-hero__cover">
        {imageSrc ? (
          <img src={imageSrc} alt="" decoding="async" fetchPriority="high" />
        ) : null}
        <div className="store-hero__coverShade" />
        <div className="store-hero__coverCopy">
          <span>Confeitaria artesanal</span>
          <strong>Doces feitos para transformar momentos.</strong>
        </div>
      </div>

      <div className="store-hero__identity">
        <div className="store-hero__logo" aria-hidden="true">
          <img src={storeConfig.logoUrl} alt="" decoding="async" />
        </div>
        <div className="store-hero__details">
          <h1 id="store-title">{storeConfig.name}</h1>
          <div className="store-hero__facts">
            <span className={hoursStatus.isOpen ? 'is-open' : 'is-closed'}>
              * {hoursStatus.label}
            </span>
            <span><FiClock /> {hoursStatus.detail}</span>
            <span><FiMapPin /> {storeConfig.city}</span>
          </div>
        </div>
        <a className="store-hero__action" href="#encomende">
          Ver cardapio
        </a>
      </div>

      <div className="store-hero__services">
        <span>
          <FiTruck /> Delivery a partir de{' '}
          {settings.minimumDeliveryFee === 0 ? 'grátis' : formatCurrency(settings.minimumDeliveryFee)}
        </span>
        <span><FiPackage /> Entrega combinada</span>
        <span><FiClock /> {settings.minimumOrder > 0 ? `Pedido mínimo ${formatCurrency(settings.minimumOrder)}` : 'Sem pedido mínimo'}</span>
      </div>
    </section>
  )
}
