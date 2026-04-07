import { products } from '@/data/landing'
import type { CartItem } from '@/types/landing'

type FloatingCartProps = {
  cartItems: CartItem[]
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onUpdateQuantity: (
    productId: string,
    optionId: string | undefined,
    nextQuantity: number,
  ) => void
  whatsappPhone: string
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function buildWhatsappLink(phone: string, message: string) {
  const normalizedPhone = phone.replace(/\D/g, '')

  if (!normalizedPhone) {
    return '#'
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

export default function FloatingCart({
  cartItems,
  isOpen,
  onOpen,
  onClose,
  onUpdateQuantity,
  whatsappPhone,
}: FloatingCartProps) {
  const cartProducts = cartItems
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId)

      if (!product) {
        return null
      }

      const selectedOption = item.optionId
        ? product.options?.find((option) => option.id === item.optionId)
        : undefined
      const unitPrice = selectedOption?.price ?? product.basePrice

      return {
        ...product,
        optionId: item.optionId,
        optionLabel: selectedOption?.label,
        optionQuantityLabel: selectedOption?.quantityLabel,
        unitPrice,
        quantity: item.quantity,
        subtotal: unitPrice * item.quantity,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  const cartCount = cartProducts.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cartProducts.reduce((sum, item) => sum + item.subtotal, 0)

  const lines = cartProducts.map(
    (item) =>
      `- ${item.name}
  ${item.optionLabel ? `Tamanho: ${item.optionLabel}\n` : ''}  Quantidade: ${item.quantity}
  Tipo: ${item.fulfillmentType === 'encomenda' ? 'Encomenda' : 'Entrega pronta'}
  Subtotal: ${formatCurrency(item.subtotal)}`,
  )

  const whatsappMessage = cartProducts.length
    ? `Olá, Encanto do Vale!

Quero fazer o seguinte pedido:

${lines.join('\n\n')}

Total estimado: ${formatCurrency(cartTotal)}

Podem me confirmar disponibilidade, prazo e forma de entrega?`
    : ''

  const whatsappCheckoutLink = buildWhatsappLink(whatsappPhone, whatsappMessage)

  return (
    <>
      <button
        type="button"
        className="menu-cartTrigger menu-cartTrigger--floating"
        aria-label={`Abrir carrinho com ${cartCount} itens`}
        onClick={onOpen}
      >
        <span className="menu-cartIcon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M3 4h2.2a1 1 0 0 1 .98.8L6.6 7H20a1 1 0 0 1 .97 1.24l-1.2 5A2 2 0 0 1 17.83 15H9a2 2 0 0 1-1.95-1.55L5.1 5.5H3"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="10" cy="19" r="1.5" fill="currentColor" />
            <circle cx="17" cy="19" r="1.5" fill="currentColor" />
          </svg>
        </span>
        {cartCount > 0 ? (
          <span className="menu-cartCount" aria-hidden="true">
            {cartCount}
          </span>
        ) : null}
      </button>

      <div className={`cart-overlay${isOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="cart-backdrop"
          aria-label="Fechar carrinho"
          onClick={onClose}
        />

        <aside className="cart-drawer">
          <div className="cart-header">
            <div>
              <p className="menu-panel-label">Seu carrinho</p>
              <h3>Resumo do pedido</h3>
            </div>
            <button type="button" className="cart-close" onClick={onClose}>
              Fechar
            </button>
          </div>

          <div className="cart-body">
            {cartProducts.length ? (
              cartProducts.map((item) => (
                <article className="cart-item" key={`${item.id}-${item.optionId ?? 'default'}`}>
                  <div className="cart-item-copy">
                    <strong>{item.name}</strong>
                    {item.optionLabel ? <span>{item.optionLabel}</span> : null}
                    <span>
                      {item.fulfillmentType === 'encomenda'
                        ? 'Encomenda'
                        : 'Entrega pronta'}
                    </span>
                    <small>
                      {formatCurrency(item.unitPrice)} cada • {formatCurrency(item.subtotal)}
                    </small>
                  </div>

                  <div className="cart-item-controls">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateQuantity(item.id, item.optionId, item.quantity - 1)
                      }
                    >
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateQuantity(item.id, item.optionId, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="cart-empty">
                <strong>Seu carrinho esta vazio.</strong>
                <p>Adicione produtos para montar o pedido e enviar no WhatsApp.</p>
              </div>
            )}
          </div>

          <div className="cart-footer">
            <div className="cart-total">
              <span>Total estimado</span>
              <strong>{formatCurrency(cartTotal)}</strong>
            </div>

            <a
              className={`cart-whatsappButton${cartProducts.length ? '' : ' is-disabled'}`}
              href={cartProducts.length ? whatsappCheckoutLink : '#'}
              target={cartProducts.length ? '_blank' : undefined}
              rel={cartProducts.length ? 'noreferrer' : undefined}
            >
              Pedir no WhatsApp
            </a>
          </div>
        </aside>
      </div>
    </>
  )
}
