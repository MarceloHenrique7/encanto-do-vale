import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  formatPhone,
  loadGuestCustomer,
  saveGuestCustomer,
  type CustomerUser,
} from '@/components/CustomerAuthGate'
import { storeConfig } from '@/config/store'
import { fromCents, toCents, type ResolvedCartItem } from '@/domain/cart'
import { formatCurrency } from '@/lib/formatters'
import { getStoreHoursStatus } from '@/lib/storeHours'

const PaymentBrick = lazy(() => import('@/components/PaymentBrick'))

type FloatingCartProps = {
  resolvedItems: ResolvedCartItem[]
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  onUpdateQuantity: (
    productId: string,
    optionId: string | undefined,
    nextQuantity: number,
    extras?: string[],
  ) => void
  whatsappPhone: string
  showTrigger?: boolean
  customerAccount: CustomerUser | null
  onCustomerAccount: (user: CustomerUser) => void
}

type PaymentMethod = 'online' | 'cash-delivery' | 'card-delivery'

type PaymentResult = {
  payment_id?: string | number
  status?: string
  status_detail?: string
  order_id: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
      ticket_url?: string
    }
  } | null
}

type CheckoutSession = {
  orderId: string
  total: number
  fingerprint: string
}

type DeliveryZone = {
  neighborhood: string
  distanceKm: number
  deliveryFee: number
  formattedDeliveryFee: string
}

type DeliveryQuote = {
  available: boolean
  neighborhood?: string
  distanceKm?: number
  deliveryFee?: number
  formattedDeliveryFee?: string
  message?: string
}

const paymentLabels: Record<PaymentMethod, string> = {
  online: 'Pix ou cartão online',
  'cash-delivery': 'Dinheiro na entrega',
  'card-delivery': 'Cartão na entrega',
}

function buildWhatsappLink(phone: string, message: string) {
  const normalizedPhone = phone.replace(/\D/g, '')
  return normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
    : '#'
}

function getTrackingUrl(orderId: string) {
  return `${window.location.origin}/pedido/${orderId}`
}

function renderWhatsappRedirectPage(targetWindow: Window) {
  const document = targetWindow.document
  document.documentElement.lang = 'pt-BR'
  document.title = `Abrindo WhatsApp | ${storeConfig.name}`
  document.body.replaceChildren()

  const style = document.createElement('style')
  style.textContent = `
    * { box-sizing: border-box; }
    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top right, rgba(196, 154, 82, .2), transparent 34%),
        #f8f5ef;
      color: #2d1b12;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(100%, 430px);
      padding: 34px;
      border: 1px solid #e8e0d5;
      border-radius: 24px;
      background: #fffdfa;
      box-shadow: 0 24px 70px rgba(58, 36, 24, .14);
      text-align: center;
    }
    .brand {
      width: 58px;
      height: 58px;
      margin: 0 auto 20px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      background: linear-gradient(145deg, #2d1b12, #513321);
      color: #ead8b7;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: .08em;
      box-shadow: 0 12px 26px rgba(58, 36, 24, .2);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 7px 11px;
      border-radius: 999px;
      background: #f2e9dc;
      color: #68472f;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .status::before {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #a9792f;
      content: "";
    }
    h1 {
      margin: 18px 0 9px;
      font-size: clamp(28px, 8vw, 38px);
      letter-spacing: -.045em;
      line-height: 1.05;
    }
    p {
      margin: 0 auto;
      max-width: 330px;
      color: #776b61;
      font-size: 15px;
      line-height: 1.6;
    }
    .loader {
      height: 42px;
      margin: 22px auto 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
    }
    .loader span {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #513321;
      animation: pulse 1s ease-in-out infinite;
    }
    .loader span:nth-child(2) { animation-delay: .15s; }
    .loader span:nth-child(3) { animation-delay: .3s; }
    small {
      color: #998d83;
      font-size: 11px;
    }
    @keyframes pulse {
      0%, 60%, 100% { opacity: .28; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-5px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .loader span { animation: none; opacity: .65; }
    }
  `

  const main = document.createElement('main')
  const brand = document.createElement('div')
  brand.className = 'brand'
  brand.textContent = 'EV'

  const status = document.createElement('span')
  status.className = 'status'
  status.textContent = 'Pedido registrado'

  const title = document.createElement('h1')
  title.textContent = 'Tudo certo!'

  const description = document.createElement('p')
  description.textContent =
    'Estamos abrindo o WhatsApp para você confirmar os detalhes do pedido com a nossa loja.'

  const loader = document.createElement('div')
  loader.className = 'loader'
  loader.setAttribute('aria-label', 'Redirecionando para o WhatsApp')
  loader.append(
    document.createElement('span'),
    document.createElement('span'),
    document.createElement('span'),
  )

  const helper = document.createElement('small')
  helper.textContent = 'Você será redirecionado automaticamente em instantes.'

  main.append(brand, status, title, description, loader, helper)
  document.head.append(style)
  document.body.append(main)
}

export default function FloatingCart({
  resolvedItems,
  isOpen,
  onOpen,
  onClose,
  onUpdateQuantity,
  whatsappPhone,
  customerAccount,
  onCustomerAccount,
  showTrigger = true,
}: FloatingCartProps) {
  const guestCustomer = loadGuestCustomer()
  const [deliveryMethod] = useState<'delivery'>('delivery')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online')
  const [customer, setCustomer] = useState({
    name: customerAccount?.name ?? guestCustomer.name,
    phone: customerAccount?.phone ?? guestCustomer.phone,
    email: '',
    address: '',
    number: '',
    neighborhood: '',
    complement: '',
  })
  const [notes, setNotes] = useState('')
  const [session, setSession] = useState<CheckoutSession | null>(null)
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null)
  const [checkoutState, setCheckoutState] = useState<
    'idle' | 'creating' | 'paying' | 'success' | 'error'
  >('idle')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([])
  const [deliveryQuote, setDeliveryQuote] = useState<DeliveryQuote | null>(null)
  const [deliveryState, setDeliveryState] = useState<
    'loading-zones' | 'idle' | 'calculating' | 'ready' | 'error'
  >('loading-zones')
  const [unsupportedNeighborhood, setUnsupportedNeighborhood] = useState(false)
  const [deliveryError, setDeliveryError] = useState('')
  const whatsappWindowRef = useRef<Window | null>(null)
  const storeHours = getStoreHoursStatus()

  useEffect(() => {
    if (!isOpen) return

    const bodyOverflow = document.body.style.overflow
    const documentOverflow = document.documentElement.style.overflow
    const documentOverscroll = document.documentElement.style.overscrollBehavior

    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.overscrollBehavior = 'none'

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = bodyOverflow
      document.documentElement.style.overflow = documentOverflow
      document.documentElement.style.overscrollBehavior = documentOverscroll
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [isOpen, onClose])

  const prepareWhatsappWindow = useCallback(() => {
    const currentWindow = whatsappWindowRef.current
    if (currentWindow && !currentWindow.closed) return

    const whatsappWindow = window.open('', '_blank')
    if (whatsappWindow) {
      renderWhatsappRedirectPage(whatsappWindow)
      whatsappWindow.opener = null
    }
    whatsappWindowRef.current = whatsappWindow
  }, [])

  const closePreparedWhatsappWindow = useCallback(() => {
    const whatsappWindow = whatsappWindowRef.current
    if (whatsappWindow && !whatsappWindow.closed) whatsappWindow.close()
    whatsappWindowRef.current = null
  }, [])

  useEffect(() => {
    if (!customerAccount) return
    setCustomer((current) => ({
      ...current,
      name: customerAccount.name,
      phone: customerAccount.phone,
    }))
  }, [customerAccount])

  useEffect(() => {
    const controller = new AbortController()

    async function loadDeliveryZones() {
      try {
        const response = await fetch('/api/delivery-zones', {
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !Array.isArray(data.zones)) {
          throw new Error('Não foi possível carregar os bairros atendidos.')
        }
        setDeliveryZones(data.zones)
        setDeliveryState('idle')
      } catch (error) {
        if (controller.signal.aborted) return
        setDeliveryState('error')
        setDeliveryError(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar os bairros atendidos.',
        )
      }
    }

    loadDeliveryZones()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (deliveryMethod !== 'delivery' || !customer.neighborhood) {
      setDeliveryQuote(null)
      if (deliveryState !== 'loading-zones' && deliveryState !== 'error') {
        setDeliveryState('idle')
      }
      return
    }

    const controller = new AbortController()
    setDeliveryState('calculating')
    setDeliveryError('')

    async function calculateDelivery() {
      try {
        const response = await fetch('/api/calculate-delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            neighborhood: customer.neighborhood,
            deliveryType: 'delivery',
          }),
          signal: controller.signal,
        })
        const data: DeliveryQuote = await response.json().catch(() => ({
          available: false,
        }))
        if (!response.ok) {
          throw new Error(data.message ?? 'Não foi possível calcular a entrega.')
        }
        if (!data.available) {
          setDeliveryQuote(null)
          setDeliveryError(
            data.message ??
              'Esse bairro ainda não está disponível para entrega.',
          )
          setDeliveryState('error')
          return
        }
        setDeliveryQuote(data)
        setDeliveryState('ready')
      } catch (error) {
        if (controller.signal.aborted) return
        setDeliveryQuote(null)
        setDeliveryState('error')
        setDeliveryError(
          error instanceof Error
            ? error.message
            : 'Não foi possível calcular a entrega.',
        )
      }
    }

    calculateDelivery()
    return () => controller.abort()
  }, [customer.neighborhood, deliveryMethod])

  const deliveryFee =
    deliveryMethod === 'delivery' ? (deliveryQuote?.deliveryFee ?? 0) : 0
  const subtotal = fromCents(
    resolvedItems.reduce((sum, item) => sum + toCents(item.subtotal), 0),
  )
  const estimatedTotal = fromCents(
    toCents(subtotal) +
      (deliveryMethod === 'delivery' ? toCents(deliveryFee) : 0),
  )
  const count = resolvedItems.reduce((sum, item) => sum + item.quantity, 0)
  const deliveryReady =
    deliveryState === 'ready' && Boolean(deliveryQuote?.available)

  const orderPayload = useMemo(
    () => ({
      customer,
      items: resolvedItems.map((item) => ({
        id: item.cartKey,
        productId: item.id,
        name: item.name,
        optionId: item.optionId,
        extraIds: item.selectedExtras.map((extra) => extra.id),
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      delivery_method: deliveryMethod,
      deliveryType: deliveryMethod,
      neighborhood:
        deliveryMethod === 'delivery' ? customer.neighborhood : '',
      delivery_fee: deliveryMethod === 'delivery' ? deliveryFee : 0,
      payment_method: paymentMethod,
      subtotal,
      total: estimatedTotal,
      notes,
    }),
    [
      customer,
      deliveryFee,
      deliveryMethod,
      estimatedTotal,
      notes,
      paymentMethod,
      resolvedItems,
      subtotal,
    ],
  )
  const fingerprint = JSON.stringify(orderPayload)
  const activeSession =
    session?.fingerprint === fingerprint ? session : null
  const canFinalize =
    storeHours.isOpen &&
    Boolean(resolvedItems.length) &&
    deliveryReady &&
    checkoutState !== 'creating' &&
    !activeSession

  function getWhatsappMessage(finalTotal: number, orderId?: string) {
    return `Olá, ${storeConfig.name}!

Quero confirmar este pedido:
${resolvedItems
  .map(
    (item) =>
      `- ${item.quantity}× ${item.name}${item.optionLabel ? ` (${item.optionLabel})` : ''} — ${formatCurrency(item.subtotal)}`,
  )
  .join('\n')}

${orderId ? `Pedido: #${orderId}\n` : ''}Cliente: ${customer.name || 'não informado'}
WhatsApp: ${customer.phone || 'não informado'}
Entrega: ${customer.address}, ${customer.number} - ${customer.neighborhood}
Taxa de entrega: ${formatCurrency(deliveryFee)}
Pagamento: ${paymentLabels[paymentMethod]}
Total: ${formatCurrency(finalTotal)}${orderId ? `\nAcompanhamento: ${getTrackingUrl(orderId)}` : ''}`
  }

  function updateCustomer(field: keyof typeof customer, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }))
    setMessage('')
  }

  function validateCheckout(requireEmail: boolean) {
    if (!storeHours.isOpen) {
      throw new Error(`A loja esta fechada agora. ${storeHours.detail}.`)
    }
    if (!resolvedItems.length) throw new Error('Adicione produtos ao carrinho.')
    if (!customer.name.trim()) throw new Error('Informe seu nome.')
    if (customer.phone.replace(/\D/g, '').length < 10) {
      throw new Error('Informe um WhatsApp válido.')
    }
    if (
      requireEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)
    ) {
      throw new Error('Informe um e-mail válido para o pagamento.')
    }
    if (
      deliveryMethod === 'delivery' &&
      (!customer.address.trim() ||
        !customer.number.trim() ||
        !customer.neighborhood.trim())
    ) {
      throw new Error('Preencha endereço, número e bairro.')
    }
    if (deliveryMethod === 'delivery' && !deliveryReady) {
      throw new Error(
        deliveryError || 'Selecione um bairro atendido para continuar.',
      )
    }
  }

  async function submitOrder(requireEmail: boolean) {
    if (checkoutState === 'creating') return
    setCheckoutState('creating')
    setMessage('')
    setPaymentResult(null)

    try {
      validateCheckout(requireEmail)
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível criar o pedido.')
      }

      if (data.user) onCustomerAccount(data.user)
      saveGuestCustomer({ name: customer.name, phone: customer.phone })

      return data as { order_id: string; total: number }
    } catch (error) {
      setCheckoutState('error')
      setMessage(
        error instanceof Error ? error.message : 'Não foi possível criar o pedido.',
      )
      return null
    }
  }

  async function createCheckoutOrder() {
    const data = await submitOrder(true)
    if (!data) return

    setSession({
      orderId: data.order_id,
      total: data.total,
      fingerprint,
    })
    setCheckoutState('paying')
  }

  async function createOfflineOrder() {
    try {
      validateCheckout(false)
    } catch (error) {
      setCheckoutState('error')
      setMessage(
        error instanceof Error ? error.message : 'Não foi possível criar o pedido.',
      )
      return
    }

    prepareWhatsappWindow()
    const data = await submitOrder(false)
    if (!data) {
      closePreparedWhatsappWindow()
      return
    }

    setCheckoutState('success')
    setSession({
      orderId: data.order_id,
      total: data.total,
      fingerprint,
    })
    setMessage(
      'Pedido registrado com sucesso! Estamos abrindo o WhatsApp para você confirmar os detalhes.',
    )
    const whatsappLink = buildWhatsappLink(
      whatsappPhone,
      getWhatsappMessage(data.total, data.order_id),
    )
    const whatsappWindow = whatsappWindowRef.current
    if (whatsappWindow && !whatsappWindow.closed) {
      whatsappWindow.location.replace(whatsappLink)
      whatsappWindowRef.current = null
    } else {
      window.location.assign(whatsappLink)
    }
  }

  function handlePaymentResult(result: PaymentResult) {
    if (
      result.status === 'rejected' ||
      result.status === 'cancelled' ||
      result.status === 'refunded'
    ) {
      closePreparedWhatsappWindow()
      setPaymentResult(null)
      setCheckoutState('error')
      setMessage(
        'Pagamento não aprovado. Confira os dados ou escolha outro meio e tente novamente.',
      )
      return
    }

    setPaymentResult(result)
    const whatsappLink = buildWhatsappLink(
      whatsappPhone,
      getWhatsappMessage(activeSession?.total ?? estimatedTotal, result.order_id),
    )
    const whatsappWindow = whatsappWindowRef.current
    const openedWhatsappSeparately = Boolean(
      whatsappWindow && !whatsappWindow.closed,
    )
    if (openedWhatsappSeparately && whatsappWindow) {
      whatsappWindow.location.replace(whatsappLink)
      whatsappWindowRef.current = null
    } else {
      window.location.assign(whatsappLink)
    }

    if (result.status === 'approved') {
      setCheckoutState('success')
      setMessage('Pagamento aprovado! Seu pedido já foi confirmado.')
      if (openedWhatsappSeparately) {
        window.location.assign(`/pedido/${result.order_id}`)
      }
      return
    }

    setCheckoutState('paying')
    setMessage(
      result.point_of_interaction?.transaction_data
        ? 'Pix criado. Faça o pagamento e acompanhe a confirmação abaixo.'
        : 'Pagamento em processamento. Acompanhe o status do pedido.',
    )
  }

  useEffect(() => {
    if (!paymentResult?.order_id || paymentResult.status === 'approved') return

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${paymentResult.order_id}`)
        if (!response.ok) return
        const order = await response.json()
        if (order.status === 'paid') {
          window.location.assign(`/pedido/${paymentResult.order_id}`)
        }
      } catch {
        // A consulta seguinte tenta novamente sem interromper o checkout.
      }
    }, 5_000)

    return () => window.clearInterval(interval)
  }, [paymentResult])

  const handlePaymentError = useCallback((errorMessage: string) => {
    closePreparedWhatsappWindow()
    setCheckoutState('error')
    setMessage(errorMessage)
  }, [closePreparedWhatsappWindow])

  const transactionData =
    paymentResult?.point_of_interaction?.transaction_data
  const pixCode = transactionData?.qr_code ?? ''

  async function copyPixCode() {
    if (!pixCode) return
    await navigator.clipboard.writeText(pixCode)
    setCopied(true)
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          className="menu-cartTrigger menu-cartTrigger--floating"
          aria-label={`Abrir carrinho com ${count} itens`}
          onClick={onOpen}
        >
          <span className="menu-cartIcon" aria-hidden="true">🛒</span>
          {count ? <span className="menu-cartCount">{count}</span> : null}
        </button>
      ) : null}

      <div className={`cart-overlay${isOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="cart-backdrop"
          aria-label="Fechar carrinho"
          onClick={onClose}
        />
        <aside
          className="cart-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-title"
        >
          <div className="cart-header">
            <div>
              <p className="menu-panel-label">Seu carrinho</p>
              <h3 id="cart-title">Resumo do pedido</h3>
            </div>
            <button type="button" className="cart-close" onClick={onClose}>
              Fechar
            </button>
          </div>

          <div className="cart-scrollArea">
            <div className="cart-body">
              {resolvedItems.length ? (
                resolvedItems.map((item) => (
                  <article className="cart-item" key={item.cartKey}>
                    <div className="cart-item-copy">
                      <strong>{item.name}</strong>
                      {item.optionLabel ? <span>{item.optionLabel}</span> : null}
                      {item.selectedExtras.length ? (
                        <span>
                          Adicionais:{' '}
                          {item.selectedExtras.map((extra) => extra.label).join(', ')}
                        </span>
                      ) : null}
                      <small>
                        {formatCurrency(item.unitPrice)} × {item.quantity} ={' '}
                        {formatCurrency(item.subtotal)}
                      </small>
                    </div>
                    <div className="cart-item-controls">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQuantity(
                            item.id,
                            item.optionId,
                            item.quantity - 1,
                            item.selectedExtras.map((extra) => extra.id),
                          )
                        }
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQuantity(
                            item.id,
                            item.optionId,
                            item.quantity + 1,
                            item.selectedExtras.map((extra) => extra.id),
                          )
                        }
                      >
                        +
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="cart-empty">
                  <strong>Seu carrinho está vazio.</strong>
                  <p>Adicione produtos para montar o pedido.</p>
                </div>
              )}
            </div>

            <div className="cart-footer">
              <div className="cart-checkoutBox">
                <div className="cart-checkoutIntro">
                  <span>Checkout seguro</span>
                  <strong>Complete seu pedido</strong>
                  <small>Preencha os dados abaixo para receber em casa.</small>
                </div>

                <div className="cart-deliveryChoice cart-deliveryChoice--single">
                  <button type="button" className="is-active">
                    {deliveryState === 'calculating'
                      ? 'Calculando entrega...'
                      : deliveryQuote?.available
                        ? deliveryFee === 0
                          ? 'Entrega gratis'
                          : `Entrega + ${formatCurrency(deliveryFee)}`
                        : 'Entrega'}
                  </button>
                </div>

                <section className="cart-formSection">
                  <div className="cart-formSectionHeading">
                    <span>1</span>
                    <div>
                      <strong>Forma de pagamento</strong>
                      <small>Escolha como prefere pagar</small>
                    </div>
                  </div>
                  <div className="cart-paymentChoice">
                    {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => (
                      <button
                        type="button"
                        className={paymentMethod === method ? 'is-active' : ''}
                        aria-pressed={paymentMethod === method}
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                      >
                        {paymentLabels[method]}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="cart-formSection">
                  <div className="cart-formSectionHeading">
                    <span>2</span>
                    <div>
                      <strong>Contato e entrega</strong>
                      <small>Seus dados para receber o pedido</small>
                    </div>
                  </div>
                  <div className="cart-customerGrid">
                  <label>
                    <span>Nome *</span>
                    <input
                      placeholder="Seu nome"
                      value={customer.name}
                      onChange={(event) =>
                        updateCustomer('name', event.target.value)
                      }
                      autoComplete="name"
                    />
                  </label>
                  <label>
                    <span>WhatsApp *</span>
                    <input
                      placeholder="(87) 99999-9999"
                      value={customer.phone}
                      onChange={(event) =>
                        updateCustomer('phone', formatPhone(event.target.value))
                      }
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </label>
                  {paymentMethod === 'online' ? (
                    <label className="cart-fieldWide">
                      <span>E-mail *</span>
                      <input
                        type="email"
                        placeholder="voce@exemplo.com"
                        value={customer.email}
                        onChange={(event) =>
                          updateCustomer('email', event.target.value)
                        }
                      />
                    </label>
                  ) : null}
                  {deliveryMethod === 'delivery' ? (
                    <>
                      <label className="cart-fieldWide">
                        <span>Endereço *</span>
                        <input
                          placeholder="Rua, avenida ou condomínio"
                          value={customer.address}
                          onChange={(event) =>
                            updateCustomer('address', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        <span>Número *</span>
                        <input
                          placeholder="Nº"
                          value={customer.number}
                          onChange={(event) =>
                            updateCustomer('number', event.target.value)
                          }
                        />
                      </label>
                      <label>
                        <span>Bairro *</span>
                        <select
                          value={
                            unsupportedNeighborhood
                              ? '__unsupported__'
                              : customer.neighborhood
                          }
                          disabled={deliveryState === 'loading-zones'}
                          onChange={(event) =>
                            {
                              const value = event.target.value
                              if (value === '__unsupported__') {
                                setUnsupportedNeighborhood(true)
                                setDeliveryQuote(null)
                                setDeliveryError(
                                  'Esse bairro ainda não está disponível para entrega. Chame no WhatsApp para consultar.',
                                )
                                updateCustomer('neighborhood', '')
                                return
                              }
                              setUnsupportedNeighborhood(false)
                              setDeliveryError('')
                              updateCustomer('neighborhood', value)
                            }
                          }
                        >
                          <option value="">
                            {deliveryState === 'loading-zones'
                              ? 'Carregando bairros…'
                              : 'Selecione o bairro'}
                          </option>
                          {deliveryZones.map((zone) => (
                            <option
                              key={zone.neighborhood}
                              value={zone.neighborhood}
                            >
                              {zone.neighborhood} -{' '}
                              {zone.deliveryFee === 0
                                ? 'Grátis'
                                : zone.formattedDeliveryFee}
                            </option>
                          ))}
                          <option value="__unsupported__">
                            Meu bairro não está na lista
                          </option>
                        </select>
                      </label>
                      <div className="cart-deliveryFeedback cart-fieldWide">
                        {deliveryState === 'calculating' ? (
                          <span>Calculando a taxa de entrega…</span>
                        ) : null}
                        {deliveryQuote?.available ? (
                          <span className="is-success">
                            Distância aproximada: {deliveryQuote.distanceKm} km
                            {' · '}
                            {deliveryFee === 0
                              ? 'Entrega grátis'
                              : `Taxa: ${formatCurrency(deliveryFee)}`}
                          </span>
                        ) : null}
                        {deliveryError ? (
                          <span className="is-error">{deliveryError}</span>
                        ) : null}
                      </div>
                      <label className="cart-fieldWide">
                        <span>Complemento</span>
                        <input
                          placeholder="Apartamento, bloco ou referência"
                          value={customer.complement}
                          onChange={(event) =>
                            updateCustomer('complement', event.target.value)
                          }
                        />
                      </label>
                    </>
                  ) : null}
                  <label className="cart-fieldWide">
                    <span>Observações</span>
                    <textarea
                      rows={3}
                      placeholder="Alguma orientação para o preparo ou entrega?"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                    />
                  </label>
                  <p className="cart-privacyNotice cart-fieldWide">
                    Ao finalizar, usamos seus dados apenas para processar e
                    acompanhar o pedido. <a href="/privacidade">Ver privacidade</a>
                  </p>
                  </div>
                </section>
              </div>

              <div className="cart-orderSummary">
                {!storeHours.isOpen ? (
                  <div className="cart-closedNotice">
                    <strong>Loja fechada agora</strong>
                    <span>{storeHours.detail}</span>
                  </div>
                ) : null}
                <div>
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div>
                  <span>Entrega</span>
                  <span>
                    {deliveryState === 'calculating'
                      ? 'Calculando...'
                      : deliveryReady
                        ? formatCurrency(deliveryFee)
                        : 'Selecione o bairro'}
                  </span>
                </div>
                <div className="cart-total">
                  <span>Total</span>
                  <strong>
                    {formatCurrency(activeSession?.total ?? estimatedTotal)}
                  </strong>
                </div>
              </div>

              {paymentMethod === 'online' && !activeSession ? (
                <button
                  type="button"
                  className="cart-onlineButton"
                  disabled={!canFinalize}
                  onClick={createCheckoutOrder}
                >
                  {checkoutState === 'creating'
                    ? 'Criando pedido…'
                    : 'Ir para pagamento'}
                </button>
              ) : null}

              {paymentMethod === 'online' && activeSession && !paymentResult ? (
                <Suspense fallback={<p>Carregando pagamento seguro…</p>}>
                  <PaymentBrick
                    amount={activeSession.total}
                    orderId={activeSession.orderId}
                    customer={{ email: customer.email }}
                    onResult={handlePaymentResult}
                    onError={handlePaymentError}
                    onPaymentStart={prepareWhatsappWindow}
                  />
                </Suspense>
              ) : null}

              {transactionData ? (
                <div className="cart-pixBox">
                  <strong>Aguardando pagamento Pix</strong>
                  {transactionData.qr_code_base64 ? (
                    <img
                      className="cart-pixQr"
                      src={`data:image/png;base64,${transactionData.qr_code_base64}`}
                      alt="QR Code do Pix"
                    />
                  ) : null}
                  {pixCode ? <textarea readOnly rows={4} value={pixCode} /> : null}
                  <div className="cart-pixActions">
                    {pixCode ? (
                      <button type="button" onClick={copyPixCode}>
                        {copied ? 'Código copiado' : 'Copiar Pix'}
                      </button>
                    ) : null}
                    {paymentResult?.order_id ? (
                      <a
                        href={buildWhatsappLink(
                          whatsappPhone,
                          getWhatsappMessage(
                            activeSession?.total ?? estimatedTotal,
                            paymentResult.order_id,
                          ),
                        )}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Avisar loja
                      </a>
                    ) : null}
                    <a href={`/pedido/${paymentResult?.order_id}`}>
                      Consultar pedido
                    </a>
                  </div>
                </div>
              ) : null}

              {message ? (
                <p
                  className={
                    checkoutState === 'error'
                      ? 'cart-checkoutError'
                      : 'cart-checkoutHint'
                  }
                  aria-live="polite"
                >
                  {message}
                </p>
              ) : null}

              {paymentResult && !transactionData ? (
                <div className="cart-postOrderActions">
                  <a
                    className="cart-onlineButton"
                    href={`/pedido/${paymentResult.order_id}`}
                  >
                    Ver status do pedido
                  </a>
                  <a
                    className="cart-whatsappButton cart-whatsappButton--secondary"
                    href={buildWhatsappLink(
                      whatsappPhone,
                      getWhatsappMessage(
                        activeSession?.total ?? estimatedTotal,
                        paymentResult.order_id,
                      ),
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Avisar loja no WhatsApp
                  </a>
                </div>
              ) : null}

              {paymentMethod !== 'online' &&
              checkoutState === 'success' &&
              activeSession ? (
                <div className="cart-postOrderActions">
                  <a
                    className="cart-onlineButton"
                    href={`/pedido/${activeSession.orderId}`}
                  >
                    Ver status e detalhes do pedido
                  </a>
                  <a
                    className="cart-whatsappButton cart-whatsappButton--secondary"
                    href={buildWhatsappLink(
                      whatsappPhone,
                      getWhatsappMessage(activeSession.total, activeSession.orderId),
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir WhatsApp novamente
                  </a>
                </div>
              ) : null}

              {paymentMethod !== 'online' ? (
                <button
                  type="button"
                  className="cart-whatsappButton"
                  disabled={!canFinalize}
                  onClick={createOfflineOrder}
                >
                  {checkoutState === 'creating'
                    ? 'Registrando pedido…'
                    : 'Registrar e confirmar no WhatsApp'}
                </button>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}
