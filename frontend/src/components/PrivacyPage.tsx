import Footer from '@/components/Footer'
import { storeConfig } from '@/config/store'

function whatsappPrivacyLink() {
  const message = `Ola, ${storeConfig.name}! Quero falar sobre meus dados pessoais.`
  return `https://wa.me/${storeConfig.whatsappPhone}?text=${encodeURIComponent(message)}`
}

export default function PrivacyPage() {
  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <a href="/" className="privacy-brand">
          <span>EV</span>
          <strong>{storeConfig.name}</strong>
        </a>
        <a href="/" className="privacy-backLink">Voltar ao cardapio</a>
      </header>

      <main className="privacy-content">
        <section className="privacy-hero">
          <span>Privacidade e LGPD</span>
          <h1>Como usamos seus dados no delivery</h1>
          <p>
            Coletamos apenas as informacoes necessarias para montar, confirmar,
            entregar e acompanhar seus pedidos.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Dados que podemos coletar</h2>
          <ul>
            <li>Nome e WhatsApp para identificar o cliente e falar sobre o pedido.</li>
            <li>Endereco, numero, bairro e complemento para realizar a entrega.</li>
            <li>Itens do pedido, valores, forma de pagamento e status do pedido.</li>
            <li>E-mail quando necessario para iniciar pagamento online.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>Por que usamos esses dados</h2>
          <ul>
            <li>Registrar e acompanhar pedidos feitos pelo cardapio digital.</li>
            <li>Calcular entrega, confirmar pagamento e organizar a producao.</li>
            <li>Enviar informacoes do pedido pelo WhatsApp quando necessario.</li>
            <li>Manter historico de pedidos pelo telefone informado pelo cliente.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>Pagamentos</h2>
          <p>
            Os pagamentos online sao processados pelo Mercado Pago. O site nao
            armazena dados completos de cartao. Recebemos apenas informacoes de
            status do pagamento para confirmar ou recusar o pedido.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Seus direitos</h2>
          <p>
            Voce pode pedir acesso, correcao ou remocao dos seus dados de
            atendimento entrando em contato pelo WhatsApp oficial da loja.
          </p>
          <a href={whatsappPrivacyLink()} target="_blank" rel="noreferrer">
            Falar sobre meus dados
          </a>
        </section>
      </main>

      <Footer />
    </div>
  )
}
