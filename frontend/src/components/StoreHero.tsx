import { FiClock, FiMapPin, FiPackage, FiTruck } from 'react-icons/fi'

import { storeConfig } from '@/config/store'
import { formatCurrency } from '@/lib/formatters'
import { getStoreHoursStatus } from '@/lib/storeHours'

type StoreHeroProps = {
  imageSrc?: string
}

export default function StoreHero({ imageSrc }: StoreHeroProps) {
  const hoursStatus = getStoreHoursStatus()

  return (
    <section className="store-hero" aria-labelledby="store-title">
      <div className="store-hero__cover">
        {imageSrc ? <img src={imageSrc} alt="" /> : null}
        <div className="store-hero__coverShade" />
        <div className="store-hero__coverCopy">
          <span>Confeitaria artesanal</span>
          <strong>Doces feitos para transformar momentos.</strong>
        </div>
      </div>

      <div className="store-hero__identity">
        <div className="store-hero__logo" aria-hidden="true">
          <img src={storeConfig.logoUrl} alt="" />
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
          {formatCurrency(storeConfig.defaultDeliveryFee)}
        </span>
        <span><FiPackage /> Entrega combinada</span>
        <span><FiClock /> {storeConfig.orderHours}</span>
      </div>
    </section>
  )
}
