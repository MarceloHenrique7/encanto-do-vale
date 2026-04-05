type HeroProps = {
  heroImage: string
  whatsappLink: string
  instagramLink: string
}

export default function Hero({
  heroImage,
  whatsappLink,
  instagramLink,
}: HeroProps) {
  return (
    <section className="hero-section" id="cardapio">
      <div className="hero-section__glow" />

      <div className="hero-layout">
        <div className="hero-text-column">
          <div className="hero-badge">
            Sobremesas artesanais com preço acessível em Petrolina - PE
          </div>

          <h1 className="hero-title">
            Sobremesas artesanais com sabor marcante e apresentacao irresistivel.
          </h1>

          <p className="hero-description">
            Da primeira colherada ao ultimo detalhe, tudo na Encanto do Vale e
            feito para encantar.
          </p>

          <div className="hero-buttons" id="compre-aqui">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="hero-button hero-button--primary"
            >
              Fazer pedido no WhatsApp
            </a>

            <a
              href={instagramLink}
              target="_blank"
              rel="noreferrer"
              className="hero-button hero-button--secondary"
            >
              Ver Instagram
            </a>
          </div>

          <div className="hero-tags">
            <span className="hero-tag">
              Feito sob encomenda
            </span>
            <span className="hero-tag">
              Recheios generosos
            </span>
            <span className="hero-tag">
              Visual premium
            </span>
            <span className="hero-tag">
              Entrega Rápida
            </span>
          </div>
        </div>

        <div className="hero-media-column">
          <div className="hero-media-shell">
            <div className="hero-media-shadow" />

            <div className="hero-media-card">
              <img
                src={heroImage}
                alt="Sobremesa premium da Encanto do Vale"
                className="hero-media-image"
              />
            </div>

            <div className="hero-signature">
              <p className="hero-signature-label">
                assinatura da marca
              </p>
              <p className="hero-signature-title">
                Prazer em Camadas
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
