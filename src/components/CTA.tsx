const giftingImage = 'https://i.ibb.co/YT8c1tfq/Chat-GPT-Image-5-de-abr-de-2026-17-15-05.png'
const howToOrderImage = 'https://i.ibb.co/ccG4zs89/Entrega-de-comida-ao-entardecer.png'

export default function CTA() {
  return (
    <section className="section cta-section" id="peca-agora">
      <div className="cta-block" id="contatos">
        <div className="cta-copy">
          <p className="section-label">Embalagens especiais</p>
          <h2>Pedidos por encomenda podem ganhar um toque ainda mais especial.</h2>
          <p className="cta-text">
            Criamos opcoes de embalagens delicadas e elegantes para transformar
            sua encomenda em presente, mimo ou surpresa para momentos
            importantes.
          </p>
          <p className="cta-text">
            E a escolha ideal para aniversarios, datas especiais, lembrancas e
            entregas que precisam impressionar desde o primeiro olhar.
          </p>
        </div>

        <div className="cta-mediaCard">
          {giftingImage ? (
            <img
              className="cta-mediaImage"
              src={giftingImage}
              alt="Embalagem especial para presentes"
            />
          ) : (
            <div className="cta-mediaPlaceholder">
              preencher url da imagem de embalagens especiais
            </div>
          )}
        </div>
      </div>

      <div className="cta-block cta-block--reverse">
        <div className="cta-copy">
          <p className="section-label">Como pedir?</p>
          <h2>Escolha seus doces, monte o carrinho e finalize tudo pelo WhatsApp.</h2>
          <p className="cta-text">
            Navegue pelo cardapio, filtre por categoria ou disponibilidade e
            adicione ao carrinho apenas os itens que deseja.
          </p>
          <p className="cta-text">
            Depois, basta abrir o carrinho flutuante e tocar em pedir no
            WhatsApp para enviar sua selecao com todas as informacoes do pedido.
          </p>
        </div>

        <div className="cta-mediaCard">
          {howToOrderImage ? (
            <img
              className="cta-mediaImage"
              src={howToOrderImage}
              alt="Como pedir na Encanto do Vale"
            />
          ) : (
            <div className="cta-mediaPlaceholder">
              preencher url da imagem de como pedir
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
