export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-shell">
        <div className="footer-brandBlock">
          <p className="footer-eyebrow">Encanto do Vale</p>
          <h2 className="footer-brand">Encanto do Vale</h2>
          <p className="footer-text">
            Sobremesas artesanais pensadas para encantar no sabor, na
            apresentacao e nos pequenos detalhes que tornam cada pedido
            memoravel.
          </p>
          <div className="footer-highlights">
            <div className="footer-highlightCard">
              <span className="footer-highlightLabel">Pedidos</span>
              <strong>Encomendas e pronta entrega</strong>
              <p>Escolha seu doce favorito e finalize tudo pelo WhatsApp.</p>
            </div>
            <div className="footer-highlightCard">
              <span className="footer-highlightLabel">Experiencia</span>
              <strong>Presentes com carinho</strong>
              <p>Embalagens especiais para momentos afetivos e memoraveis.</p>
            </div>
          </div>
        </div>

        <div className="footer-utilityPanel">
          <div className="footer-linksGrid">
            <div className="footer-column">
              <h3>Navegacao</h3>
              <a href="#cardapio">Cardapio</a>
              <a href="#encomende">Encomende</a>
              <a href="#peca-agora">Como pedir</a>
              <a href="#faq">FAQ</a>
            </div>

            <div className="footer-column">
              <h3>Atendimento</h3>
              <p>Delivery e retirada sob consulta</p>
              <p>Pedidos pelo WhatsApp com resposta rapida</p>
              <p>Encomendas com prazo combinado</p>
            </div>

            <div className="footer-column">
              <h3>Contato</h3>
              <a href="https://wa.me/5587988028002" target="_blank" rel="noreferrer">
                WhatsApp
              </a>
              <a href="https://instagram.com/doceria.encantodovale" target="_blank" rel="noreferrer">
                Instagram
              </a>
              <a href="mailto:encantodovale986@gmail.com">
                Gmail
              </a>
            </div>
          </div>

          <div className="footer-ctaStrip">
            <div>
              <span className="footer-ctaLabel">Peça com facilidade</span>
              <strong>Monte seu carrinho e envie o pedido em segundos</strong>
            </div>
            <a
              className="footer-ctaButton"
              href="https://wa.me/5587988028002"
              target="_blank"
              rel="noreferrer"
            >
              Chamar no WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>Encanto do Vale</span>
        <span>Feito para pedidos, presentes e momentos especiais.</span>
      </div>
    </footer>
  )
}
