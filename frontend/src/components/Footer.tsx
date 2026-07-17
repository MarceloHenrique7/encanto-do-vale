import { storeConfig } from '@/config/store'

export default function Footer() {
  return (
    <footer className="footer" id="contatos">
      <div className="footer-main">
        <div>
          <span className="footer-brand">
            <img src={storeConfig.logoUrl} alt="" loading="lazy" decoding="async" />
          </span>
          <strong>{storeConfig.name}</strong>
          <p>{storeConfig.serviceSummary}</p>
        </div>
        <div>
          <span>Atendimento</span>
          <a href={`https://wa.me/${storeConfig.whatsappPhone}`}>WhatsApp</a>
          <a href={storeConfig.instagramUrl}>Instagram</a>
          <a href={`mailto:${storeConfig.email}`}>E-mail</a>
          <a href="/privacidade">Privacidade</a>
        </div>
        <div>
          <span>Onde estamos</span>
          <strong>{storeConfig.city}</strong>
          <p>{storeConfig.orderHours}</p>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} {storeConfig.name}</span>
        <span>Feito com carinho para adoçar bons momentos.</span>
      </div>
    </footer>
  )
}
