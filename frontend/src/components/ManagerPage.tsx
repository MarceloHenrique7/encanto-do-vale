import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'

import { formatCurrency } from '@/lib/formatters'
import CatalogManager from '@/components/CatalogManager'

type RestaurantStatus =
  | 'awaiting_payment'
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'cancelled'

type ManagerOrder = {
  id: string
  status: string
  restaurant_status?: RestaurantStatus
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
  delivery_method: 'pickup' | 'delivery'
  delivery_fee: number
  total: number
  notes?: string
  created_at: string
}

const statusLabels: Record<RestaurantStatus, string> = {
  awaiting_payment: 'Aguardando pagamento',
  new: 'Pagamento aprovado',
  accepted: 'Pedido esta sendo preparado',
  preparing: 'Pedido esta sendo preparado',
  ready: 'Pedido saiu para entrega',
  completed: 'Pedido finalizado',
  cancelled: 'Cancelado',
}

const nextActions: Partial<
  Record<RestaurantStatus, { status: RestaurantStatus; label: string }>
> = {
  new: { status: 'preparing', label: 'Iniciar preparo' },
  accepted: { status: 'ready', label: 'Saiu para entrega' },
  preparing: { status: 'ready', label: 'Saiu para entrega' },
  ready: { status: 'completed', label: 'Finalizar pedido' },
}

let alertAudioContext: AudioContext | null = null
let alertSource: AudioBufferSourceNode | null = null
let alertGain: GainNode | null = null

function getAudioContext() {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioContextClass) return null
  alertAudioContext ??= new AudioContextClass()
  return alertAudioContext
}

function createAlertBuffer(context: AudioContext) {
  const duration = 2.45
  const buffer = context.createBuffer(
    1,
    Math.floor(context.sampleRate * duration),
    context.sampleRate,
  )
  const samples = buffer.getChannelData(0)
  const strikes = [0.08, 0.38, 0.68]
  const partials = [
    { frequency: 784, amplitude: 0.5, decay: 7.8 },
    { frequency: 1176, amplitude: 0.34, decay: 8.6 },
    { frequency: 1568, amplitude: 0.22, decay: 9.8 },
    { frequency: 2352, amplitude: 0.12, decay: 12 },
  ]

  for (let index = 0; index < samples.length; index += 1) {
    const time = index / context.sampleRate
    let sample = 0
    for (const strike of strikes) {
      const localTime = time - strike
      if (localTime < 0 || localTime > 0.9) continue
      const attack = Math.min(1, localTime / 0.003)
      for (const partial of partials) {
        const vibrato = 1 + 0.0025 * Math.sin(2 * Math.PI * 11 * localTime)
        const envelope =
          attack * Math.exp(-partial.decay * localTime) * partial.amplitude
        sample +=
          Math.sin(2 * Math.PI * partial.frequency * vibrato * localTime) *
          envelope
      }
      // Um clique curto ajuda o alerta a cortar o ruido da cozinha sem depender de arquivo externo.
      if (localTime < 0.012) {
        sample +=
          (Math.sin(2 * Math.PI * 3200 * localTime) * (0.012 - localTime)) /
          0.038
      }
    }
    samples[index] = Math.max(-0.86, Math.min(0.86, sample))
  }
  return buffer
}

async function unlockAudio() {
  const context = getAudioContext()
  if (!context) return false
  if (context.state === 'suspended') await context.resume()
  return context.state === 'running'
}

function startContinuousAlert(volume: number) {
  const context = getAudioContext()
  if (!context || context.state !== 'running') return false
  if (alertSource && alertGain) {
    alertGain.gain.setTargetAtTime(volume / 100, context.currentTime, 0.03)
    return true
  }

  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = createAlertBuffer(context)
  source.loop = true
  gain.gain.value = volume / 100
  source.connect(gain)
  gain.connect(context.destination)
  source.start()
  source.onended = () => {
    if (alertSource === source) {
      alertSource = null
      alertGain = null
    }
  }
  alertSource = source
  alertGain = gain
  return true
}

function stopContinuousAlert() {
  try {
    alertSource?.stop()
  } catch {
    // A fonte já pode ter sido encerrada pelo navegador.
  }
  alertSource = null
  alertGain = null
}

async function playAlertPreview(volume: number) {
  if (!(await unlockAudio())) return false
  const context = getAudioContext()
  if (!context) return false
  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = createAlertBuffer(context)
  source.loop = true
  gain.gain.value = volume / 100
  source.connect(gain)
  gain.connect(context.destination)
  source.start()
  source.stop(context.currentTime + 4.8)
  return true
}

function elapsedTime(date: string) {
  const minutes = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 60_000),
  )
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  return `há ${Math.floor(minutes / 60)}h`
}

function whatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`
}

export default function ManagerPage() {
  const [sessionState, setSessionState] = useState<
    'loading' | 'login' | 'authenticated'
  >('loading')
  const [configured, setConfigured] = useState(true)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [orders, setOrders] = useState<ManagerOrder[]>([])
  const [filter, setFilter] = useState<'active' | RestaurantStatus>('active')
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [actionError, setActionError] = useState('')
  const [activeSection, setActiveSection] = useState<'orders' | 'catalog'>(
    'orders',
  )
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [audioReady, setAudioReady] = useState(false)
  const [volume, setVolume] = useState(
    () => Math.max(75, Number(localStorage.getItem('manager-volume') ?? 90)),
  )
  const seenNewOrders = useRef<Set<string> | null>(null)
  const lastNotificationAt = useRef(0)
  const originalTitle = useRef(document.title)

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoadingOrders(true)
    try {
      const response = await fetch('/api/admin/orders')
      if (response.status === 401) {
        setSessionState('login')
        return
      }
      const data = await response.json()
      const nextOrders: ManagerOrder[] = data.orders ?? []
      const currentNewIds = new Set(
        nextOrders
          .filter((order) => {
            const isDeliveryPaymentOrder =
              order.payment_method === 'cash-delivery' ||
              order.payment_method === 'card-delivery'
            const restaurantStatus =
              order.restaurant_status ??
              (order.status === 'paid' || isDeliveryPaymentOrder
                ? 'new'
                : 'awaiting_payment')
            return restaurantStatus === 'new'
          })
          .map((order) => order.id),
      )

      const newlyReceived =
        seenNewOrders.current &&
        [...currentNewIds].filter((id) => !seenNewOrders.current?.has(id))
      if (
        newlyReceived &&
        newlyReceived.length > 0 &&
        'Notification' in window &&
        Notification.permission === 'granted' &&
        Date.now() - lastNotificationAt.current > 10_000
      ) {
        lastNotificationAt.current = Date.now()
        new Notification('Novo pedido pago!', {
          body: 'Abra o gestor para aceitar e iniciar o preparo.',
          icon: 'https://i.ibb.co/RTXYmRKC/Chat-GPT-Image-27-de-mar-de-2026-22-55-42.png',
          requireInteraction: true,
          tag: newlyReceived[0],
        })
      }
      seenNewOrders.current = currentNewIds
      setOrders(nextOrders)
      setActionError('')
    } catch {
      setActionError('Não foi possível atualizar os pedidos.')
    } finally {
      setLoadingOrders(false)
    }
  }, [])

  useEffect(() => {
    async function loadSession() {
      const response = await fetch('/api/admin/session')
      const data = await response.json()
      setConfigured(data.configured)
      setSessionState(data.authenticated ? 'authenticated' : 'login')
    }
    loadSession()
  }, [])

  useEffect(() => {
    if (sessionState !== 'authenticated') return
    loadOrders()
    const interval = window.setInterval(() => loadOrders(true), 5_000)
    const eventSource = new EventSource('/api/admin/orders/stream')
    eventSource.onmessage = () => loadOrders(true)
    const refreshOnReturn = () => loadOrders(true)
    window.addEventListener('focus', refreshOnReturn)
    document.addEventListener('visibilitychange', refreshOnReturn)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshOnReturn)
      document.removeEventListener('visibilitychange', refreshOnReturn)
      eventSource.close()
    }
  }, [loadOrders, sessionState])

  useEffect(() => {
    if (sessionState !== 'authenticated' || audioReady) return

    const enableAudio = () => {
      void activateAlerts(false)
    }

    void activateAlerts(false)
    window.addEventListener('pointerdown', enableAudio, { once: true })
    window.addEventListener('keydown', enableAudio, { once: true })
    window.addEventListener('focus', enableAudio)

    return () => {
      window.removeEventListener('pointerdown', enableAudio)
      window.removeEventListener('keydown', enableAudio)
      window.removeEventListener('focus', enableAudio)
    }
  }, [audioReady, sessionState])

  async function login(event: FormEvent) {
    event.preventDefault()
    setLoginError('')
    await activateAlerts(false)
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setLoginError(data.error ?? 'Não foi possível entrar.')
      return
    }
    setPassword('')
    setSessionState('authenticated')
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    setOrders([])
    setSessionState('login')
  }

  async function updateStatus(orderId: string, status: RestaurantStatus) {
    const response = await fetch(`/api/admin/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setActionError(data.error ?? 'Não foi possível atualizar o pedido.')
      return
    }
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? { ...order, restaurant_status: status }
          : order,
      ),
    )
  }

  async function activateAlerts(playPreview = true) {
    const ready = await unlockAudio()
    setAudioReady(ready)
    setSoundEnabled(true)
    localStorage.setItem('manager-sound', 'on')
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    if (ready && newCount > 0) {
      startContinuousAlert(volume)
    } else if (ready && playPreview) {
      await playAlertPreview(volume)
    }
  }

  const activeStatuses: RestaurantStatus[] = [
    'new',
    'accepted',
    'preparing',
    'ready',
  ]
  const filteredOrders = orders.filter((order) => {
    const status =
      order.restaurant_status ??
      (order.status === 'paid' ? 'new' : 'awaiting_payment')
    return filter === 'active'
      ? activeStatuses.includes(status)
      : status === filter
  })
  const newCount = orders.filter((order) => {
    const isDeliveryPaymentOrder =
      order.payment_method === 'cash-delivery' ||
      order.payment_method === 'card-delivery'
    const restaurantStatus =
      order.restaurant_status ??
      (order.status === 'paid' || isDeliveryPaymentOrder ? 'new' : 'awaiting_payment')
    return restaurantStatus === 'new'
  }).length

  useEffect(() => {
    if (
      sessionState === 'authenticated' &&
      soundEnabled &&
      audioReady &&
      newCount > 0
    ) {
      startContinuousAlert(volume)
    } else {
      stopContinuousAlert()
    }
    return () => stopContinuousAlert()
  }, [audioReady, newCount, sessionState, soundEnabled, volume])

  useEffect(() => {
    if (sessionState !== 'authenticated' || newCount <= 0) {
      document.title = originalTitle.current
      return
    }

    let visible = false
    const interval = window.setInterval(() => {
      visible = !visible
      document.title = visible
        ? `(${newCount}) Novo pedido!`
        : originalTitle.current
    }, 900)

    return () => {
      window.clearInterval(interval)
      document.title = originalTitle.current
    }
  }, [newCount, sessionState])

  if (sessionState === 'loading') {
    return <main className="manager-loginPage">Carregando gestor…</main>
  }

  if (sessionState === 'login') {
    return (
      <main className="manager-loginPage">
        <section className="manager-loginCard">
          <div className="manager-brandMark">E</div>
          <span>Encanto do Vale</span>
          <h1>Gestor de pedidos</h1>
          <p>Entre para acompanhar a cozinha e as entregas em tempo real.</p>
          {!configured ? (
            <div className="manager-configWarning">
              Configure <code>ADMIN_PASSWORD</code> e{' '}
              <code>SESSION_SECRET</code> no `.env.local`.
            </div>
          ) : null}
          <form onSubmit={login}>
            <label>
              Senha do gestor
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </label>
            <button type="submit" disabled={!configured || !password}>
              Entrar
            </button>
          </form>
          {loginError ? <p className="manager-error">{loginError}</p> : null}
          <a href="/">Voltar ao cardápio</a>
        </section>
      </main>
    )
  }

  return (
    <div className="manager-shell">
      <header className="manager-header">
        <div className="manager-logo">
          <div className="manager-brandMark">E</div>
          <div>
            <strong>Encanto do Vale</strong>
            <span>Gestor da loja</span>
          </div>
        </div>
        <div className="manager-headerActions">
          <button
            type="button"
            className={soundEnabled && audioReady ? 'is-active' : ''}
            onClick={() => activateAlerts(true)}
          >
            {soundEnabled && audioReady ? 'Alertas ativos' : 'Ativar alertas'}
          </button>
          <button type="button" onClick={() => loadOrders()}>
            {loadingOrders ? 'Atualizando…' : 'Atualizar'}
          </button>
          <button type="button" onClick={logout}>Sair</button>
        </div>
      </header>

      <main className="manager-main">
        <nav className="manager-sectionNav" aria-label="Áreas do gestor">
          <button
            type="button"
            className={activeSection === 'orders' ? 'is-active' : ''}
            onClick={() => setActiveSection('orders')}
          >
            Pedidos {newCount ? <b>{newCount}</b> : null}
          </button>
          <button
            type="button"
            className={activeSection === 'catalog' ? 'is-active' : ''}
            onClick={() => setActiveSection('catalog')}
          >
            Produtos e categorias
          </button>
          <a href="/" target="_blank" rel="noreferrer">Ver cardápio</a>
        </nav>

        {activeSection === 'catalog' ? <CatalogManager /> : (
          <>
        <section className="manager-welcome">
          <div>
            <span>Operação agora</span>
            <h1>Pedidos da loja</h1>
            <p>Pedidos recebidos em tempo real, mesmo com a aba em segundo plano.</p>
          </div>
          <div className="manager-newMetric">
            <strong>{newCount}</strong>
            <span>{newCount === 1 ? 'novo pedido' : 'novos pedidos'}</span>
          </div>
        </section>

        <section
          className={`manager-soundPanel${
            newCount > 0 && soundEnabled && audioReady ? ' is-alarming' : ''
          }`}
        >
          <div>
            <strong>
              {newCount > 0 && soundEnabled && audioReady
                ? 'Sininho tocando — aceite o pedido'
                : 'Alerta contínuo de novos pedidos'}
            </strong>
            <span>
              Toca em volume alto até todos os pedidos novos serem aceitos.
              Mantenha o gestor aberto no navegador e ative uma vez para tocar em segundo plano.
            </span>
          </div>
          <input
            type="range"
            min="50"
            max="100"
            value={volume}
            aria-label="Volume do alerta"
            onChange={(event) => {
              const nextVolume = Number(event.target.value)
              setVolume(nextVolume)
              localStorage.setItem('manager-volume', String(nextVolume))
            }}
          />
          <button
            type="button"
            onClick={() =>
              audioReady ? playAlertPreview(volume) : activateAlerts()
            }
          >
            {audioReady ? 'Testar sininho' : 'Ativar agora'}
          </button>
        </section>

        <nav className="manager-filters" aria-label="Filtrar pedidos">
          {[
            ['active', 'Em andamento'],
            ['new', 'Pagamento aprovado'],
            ['preparing', 'Em preparo'],
            ['ready', 'Saiu para entrega'],
            ['completed', 'Finalizados'],
            ['cancelled', 'Cancelados'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={filter === value ? 'is-active' : ''}
              onClick={() => setFilter(value as typeof filter)}
            >
              {label}
            </button>
          ))}
        </nav>

        {actionError ? <p className="manager-error">{actionError}</p> : null}

        <section className="manager-orderGrid">
          {filteredOrders.length ? (
            filteredOrders.map((order) => {
              const restaurantStatus =
                order.restaurant_status ??
                (order.status === 'paid' ? 'new' : 'awaiting_payment')
              const action = nextActions[restaurantStatus]
              return (
                <article
                  className={`manager-orderCard manager-orderCard--${restaurantStatus}`}
                  key={order.id}
                >
                  <div className="manager-orderTop">
                    <div>
                      <span>#{order.id.slice(0, 8).toUpperCase()}</span>
                      <strong>{order.customer.name}</strong>
                    </div>
                    <div>
                      <span>{elapsedTime(order.created_at)}</span>
                      <b>{statusLabels[restaurantStatus]}</b>
                    </div>
                  </div>
                  <div className="manager-orderItems">
                    {order.items.map((item) => (
                      <div key={item.id}>
                        <strong>{item.quantity}×</strong>
                        <span>{item.name}</span>
                      </div>
                    ))}
                  </div>
                  {order.notes ? (
                    <p className="manager-orderNotes">Obs.: {order.notes}</p>
                  ) : null}
                  <div className="manager-orderDelivery">
                    <strong>
                      {order.delivery_method === 'delivery'
                        ? 'Entrega'
                        : 'Entrega combinada'}
                    </strong>
                    {order.delivery_method === 'delivery' ? (
                      <span>
                        {order.customer.address}, {order.customer.number} —{' '}
                        {order.customer.neighborhood}
                        {order.customer.complement
                          ? `, ${order.customer.complement}`
                          : ''}
                      </span>
                    ) : null}
                    <a href={whatsappLink(order.customer.phone)}>
                      WhatsApp do cliente
                    </a>
                  </div>
                  <div className="manager-orderFooter">
                    <strong>{formatCurrency(order.total)}</strong>
                    <div>
                      {action ? (
                        <button
                          type="button"
                          className="manager-primaryAction"
                          onClick={() => updateStatus(order.id, action.status)}
                        >
                          {action.label}
                        </button>
                      ) : null}
                      {!['completed', 'cancelled'].includes(restaurantStatus) ? (
                        <button
                          type="button"
                          className="manager-cancelAction"
                          onClick={() => updateStatus(order.id, 'cancelled')}
                        >
                          Cancelar
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })
          ) : (
            <div className="manager-empty">
              <span>✓</span>
              <strong>Nenhum pedido nesta etapa</strong>
              <p>A fila está em dia. Novos pedidos aparecerão automaticamente.</p>
            </div>
          )}
        </section>
          </>
        )}
      </main>
    </div>
  )
}
