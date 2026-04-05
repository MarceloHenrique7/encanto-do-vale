import { FiHelpCircle, FiUser } from 'react-icons/fi'

const faqItems = [
  {
    question: 'Vocês fazem delivery no mesmo dia?',
    answer:
      'Sim, para itens de entrega pronta a disponibilidade pode ser confirmada no momento do pedido pelo WhatsApp.',
  },
  {
    question: 'Quais produtos precisam ser encomendados com antecedência?',
    answer:
      'Tortas, bolos e pedidos personalizados normalmente funcionam por encomenda, com prazo combinado conforme a data e o tamanho do pedido.',
  },
  {
    question: 'Posso pedir um doce para presentear alguém?',
    answer:
      'Sim. Temos opções de embalagens especiais para presentes, mimos e datas comemorativas em pedidos por encomenda.',
  },
  {
    question: 'Como faço meu pedido pelo site?',
    answer:
      'Você pode escolher os produtos, adicionar ao carrinho e finalizar tudo pelo botão de pedido no WhatsApp com a mensagem já preenchida.',
  },
  {
    question: 'É possível combinar horário de entrega?',
    answer:
      'Sim. No atendimento pelo WhatsApp você pode alinhar disponibilidade, horário, endereço e detalhes finais da entrega.',
  },
]

export default function FAQ() {
  return (
    <section className="section faq-section" id="faq">
      <div className="faq-shell">
        <div className="faq-heading">
          <p className="section-label">Perguntas frequentes</p>
          <h2>Respostas rápidas para te ajudar a pedir com mais facilidade.</h2>
          <p className="faq-description">
            Separamos algumas dúvidas comuns sobre delivery, encomendas e o
            funcionamento dos pedidos.
          </p>
        </div>

        <div className="faq-grid">
          {faqItems.map((item) => (
            <article className="faq-card" key={item.question}>
              <div className="faq-card-iconRow">
                <span className="faq-icon faq-icon--person">
                  <FiUser />
                </span>
                <span className="faq-icon faq-icon--help">
                  <FiHelpCircle />
                </span>
              </div>

              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
