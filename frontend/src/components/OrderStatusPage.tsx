import { useCallback, useEffect, useMemo, useState } from 'react'

import { storeConfig } from '@/config/store'
import { formatCurrency } from '@/lib/formatters'

type RestaurantStatus =
  | 'awaiting_payment'
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'

type OrderPaymentStatus = 'pending' | 'waiting_payment' | 'paid' | 'failed'

type Order = {
  order_id: string
  status: OrderPaymentStatus
  restaurant_status: RestaurantStatus
  payment_status?: string | null
  payment_method?: 'online' | 'cash-delivery' | 'card-delivery'
  status_detail?: string | null
  total: number
  subtotal: number
  delivery_fee: number
  delivery_method: 'pickup' | 'delivery'
  created_at: string
  customer: {
    name: string
    phone: string
    address: string
    number: string
    neighborhood: string
    complement: string
  }
  items: Array<{
    id: string
    name: string
    quantity: number
    unit_price: number
  }>
}

type TrackingState =
  | 'awaiting_payment'
  | 'payment_processing'
  | 'payment_failed'
  | 'payment_approved'
  | 'preparing'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'

const timeline = [
  'Pagamento aprovado',
  'Pedido esta sendo preparado',
  'Pedido saiu para entrega',
  'Pedido finalizado',
]

const trackingCopy: Record<
  TrackingState,
  { title: string; text: string; step: number; tone: 'waiting' | 'success' | 'danger' | 'done' }
> = {
  awaiting_payment: {
    title: 'Aguardando pagamento',
    text: 'Seu pedido foi criado, mas ainda falta a confirmacao do pagamento. Se escolheu Pix, pague pelo codigo gerado no checkout.',
    step: 0,
    tone: 'waiting',
  },
  payment_processing: {
    title: 'Pagamento em analise',
    text: 'O Mercado Pago ainda esta processando a confirmacao. Esta pagina atualiza sozinha.',
    step: 0,
    tone: 'waiting',
  },
  payment_failed: {
    title: 'Pagamento nao aprovado',
    text: 'O pagamento nao foi aprovado ou expirou. Voce pode refazer o pedido ou falar com a loja para ajuda.',
    step: 0,
    tone: 'danger',
  },
  payment_approved: {
    title: 'Pagamento aprovado',
    text: 'Recebemos seu pagamento e a loja ja recebeu o pedido.',
    step: 1,
    tone: 'success',
  },
  preparing: {
    title: 'Pedido esta sendo preparado',
    text: 'A loja esta preparando seu pedido com cuidado. Avisaremos quando sair para entrega.',
    step: 2,
    tone: 'success',
  },
  out_for_delivery: {
    title: 'Pedido saiu para entrega',
    text: 'Seu pedido saiu para entrega e esta a caminho.',
    step: 3,
    tone: 'success',
  },
  completed: {
    title: 'Pedido finalizado',
    text: 'Pedido finalizado. Obrigado pela preferencia!',
    step: 4,
    tone: 'done',
  },
  cancelled: {
    title: 'Pedido cancelado',
    text: 'Este pedido foi cancelado. Fale com a loja se precisar de ajuda.',
    step: 0,
    tone: 'danger',
  },
}

function resolveTrackingState(order: Order): TrackingState {
  if (order.restaurant_status === 'cancelled') return 'cancelled'
  if (order.status === 'failed') return 'payment_failed'
  if (
    order.payment_method === 'cash-delivery' ||
    order.payment_method === 'card-delivery'
  ) {
    if (order.restaurant_status === 'completed') return 'completed'
    if (order.restaurant_status === 'ready') return 'out_for_delivery'
    if (
      order.restaurant_status === 'preparing' ||
      order.restaurant_status === 'accepted'
    ) {
      return 'preparing'
    }
    return 'payment_approved'
  }
  if (order.status === 'waiting_payment') return 'payment_processing'
  if (order.status === 'pending' || order.restaurant_status === 'awaiting_payment') {
    return 'awaiting_payment'
  }
  if (order.restaurant_status === 'completed') return 'completed'
  if (order.restaurant_status === 'ready') return 'out_for_delivery'
  if (
    order.restaurant_status === 'preparing' ||
    order.restaurant_status === 'accepted'
  ) {
    return 'preparing'
  }
  return 'payment_approved'
}

function buildWhatsappLink(order: Order) {
  const trackingUrl = `${window.location.origin}/pedido/${order.order_id}`
  const message = `Ola, ${storeConfig.name}! Quero falar sobre o pedido #${order.order_id.slice(0, 8).toUpperCase()}.

Cliente: ${order.customer.name}
Status: ${trackingCopy[resolveTrackingState(order)].title}
Total: ${formatCurrency(order.total)}
Acompanhamento: ${trackingUrl}`
  return `https://wa.me/${storeConfig.whatsappPhone}?text=${encodeURIComponent(message)}`
}

function formatStatusDetail(detail?: string | null) {
  if (detail === 'expired_pix') return 'Pix expirado'
  return detail
}

export default function OrderStatusPage({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadOrder = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? 'Nao foi possivel consultar o pedido.')
      }
      setOrder(data)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Nao foi possivel consultar o pedido.',
      )
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    loadOrder()
    const interval = window.setInterval(() => loadOrder(true), 6_000)
    return () => window.clearInterval(interval)
  }, [loadOrder])

  const tracking = useMemo(() => {
    if (!order) return null
    const state = resolveTrackingState(order)
    return { state, copy: trackingCopy[state] }
  }, [order])

  if (loading && !order) {
    return <main className="order-trackingPage">Consultando pedido...</main>
  }

  if (error && !order) {
    return (
      <main className="order-trackingPage">
        <section className="order-trackingCard order-trackingError">
          <p className="cart-checkoutError">{error}</p>
          <a className="order-backLink" href="/">Voltar ao cardapio</a>
        </section>
      </main>
    )
  }

  if (!order || !tracking) return null

  const { copy, state } = tracking
  const showTimeline = !['awaiting_payment', 'payment_processing', 'payment_failed', 'cancelled'].includes(state)
  const paymentLabel =
    order.payment_method === 'cash-delivery'
      ? 'Dinheiro na entrega'
      : order.payment_method === 'card-delivery'
        ? 'Cartao na entrega'
        : 'Pagamento online'

  return (
    <main className="order-trackingPage">
      <header className="order-trackingHeader">
        <a href="/" className="order-trackingBrand">
          <span>E</span>
          <div>
            <strong>{storeConfig.name}</strong>
            <small>Acompanhe seu pedido</small>
          </div>
        </a>
        <span className="order-liveBadge">Atualizacao automatica</span>
      </header>

      <div className="order-trackingLayout">
        <section className={`order-trackingCard order-trackingHero order-trackingHero--${copy.tone}`}>
          <span className={`order-statusPill order-statusPill--${state}`}>
            Pedido #{order.order_id.slice(0, 8).toUpperCase()}
          </span>
          <h1>{copy.title}</h1>
          <p>{copy.text}</p>

          <div className="order-paymentPanel">
            <div>
              <span>Pagamento</span>
              <strong>{paymentLabel}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{copy.title}</strong>
            </div>
            {formatStatusDetail(order.status_detail) ? (
              <small>Detalhe: {formatStatusDetail(order.status_detail)}</small>
            ) : null}
          </div>

          {showTimeline ? (
            <ol className="order-timeline">
              {timeline.map((label, index) => (
                <li
                  key={label}
                  className={copy.step >= index + 1 ? 'is-complete' : ''}
                >
                  <span>{copy.step > index + 1 ? '✓' : index + 1}</span>
                  <strong>{label}</strong>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="order-statusActions">
            <button type="button" onClick={() => loadOrder()} disabled={loading}>
              {loading ? 'Atualizando...' : 'Atualizar agora'}
            </button>
            <a href={buildWhatsappLink(order)} target="_blank" rel="noreferrer">
              Avisar pelo WhatsApp
            </a>
            {state === 'payment_failed' ? <a href="/">Refazer pedido</a> : null}
          </div>
        </section>

        <aside className="order-trackingCard order-summaryCard">
          <div className="order-summaryTitle">
            <div>
              <span>Resumo</span>
              <h2>Seu pedido</h2>
            </div>
            <small>
              {new Date(order.created_at).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </small>
          </div>

          <div className="order-summaryItems">
            {order.items.map((item) => (
              <div key={item.id}>
                <span><b>{item.quantity}x</b> {item.name}</span>
                <strong>{formatCurrency(item.unit_price * item.quantity)}</strong>
              </div>
            ))}
          </div>

          <div className="order-summaryPrices">
            <div><span>Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            <div>
              <span>Entrega</span>
              <span>{formatCurrency(order.delivery_fee)}</span>
            </div>
            <div className="order-summaryTotal">
              <strong>Total</strong>
              <strong>{formatCurrency(order.total)}</strong>
            </div>
          </div>

          <div className="order-deliveryDetails">
            <span>
              Endereco de entrega
            </span>
            <strong>
              {order.customer.address
                ? `${order.customer.address}, ${order.customer.number}`
                : 'Entrega combinada com a loja'}
            </strong>
            {order.customer.neighborhood ? (
              <p>
                {order.customer.neighborhood}
                {order.customer.complement ? ` - ${order.customer.complement}` : ''}
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  )
}
