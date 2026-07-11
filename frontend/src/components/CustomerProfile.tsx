import { FormEvent, useEffect, useState } from 'react'

import type { CustomerUser } from '@/components/CustomerAuthGate'

type CustomerProfileProps = {
  user: CustomerUser
  isOpen: boolean
  onClose: () => void
  onUpdate: (user: CustomerUser) => void
}

type CustomerOrder = {
  order_id: string
  status: string
  restaurant_status: string
  payment_method: string
  total: number
  created_at: string
  items: Array<{ name: string; quantity: number }>
}

function statusLabel(order: CustomerOrder) {
  if (order.status === 'failed') return 'Pagamento recusado'
  if (order.status === 'waiting_payment' || order.status === 'pending') {
    return order.payment_method === 'online'
      ? 'Pagamento pendente'
      : 'Pedido recebido'
  }
  if (order.restaurant_status === 'preparing') return 'Pedido em preparo'
  if (order.restaurant_status === 'ready') return 'Saiu para entrega'
  if (order.restaurant_status === 'completed') return 'Pedido finalizado'
  return 'Pagamento aprovado'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function CustomerProfile({
  user,
  isOpen,
  onClose,
  onUpdate,
}: CustomerProfileProps) {
  const [name, setName] = useState(user.name)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [ordersError, setOrdersError] = useState('')
  const [loadingOrders, setLoadingOrders] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    let active = true
    setLoadingOrders(true)
    setOrdersError('')
    fetch('/api/orders')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.error ?? 'Nao foi possivel carregar os pedidos.')
        }
        if (active) setOrders(Array.isArray(data.orders) ? data.orders : [])
      })
      .catch((requestError) => {
        if (!active) return
        setOrdersError(
          requestError instanceof Error
            ? requestError.message
            : 'Nao foi possivel carregar os pedidos.',
        )
      })
      .finally(() => {
        if (active) setLoadingOrders(false)
      })

    return () => {
      active = false
    }
  }, [isOpen])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          current_password: currentPassword || undefined,
          new_password: newPassword || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível salvar.')
      onUpdate(data.user)
      setCurrentPassword('')
      setNewPassword('')
      setMessage('Perfil atualizado.')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível salvar.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.assign('/')
  }

  return (
    <div className={`customer-profileOverlay${isOpen ? ' is-open' : ''}`}>
      <button
        type="button"
        className="customer-profileBackdrop"
        aria-label="Fechar perfil"
        onClick={onClose}
      />
      <aside className="customer-profileDrawer" aria-hidden={!isOpen}>
        <div className="customer-profileHeader">
          <div>
            <span>Minha conta</span>
            <h2>Olá, {user.name.split(' ')[0]}</h2>
          </div>
          <button type="button" onClick={onClose}>Fechar</button>
        </div>
        <form onSubmit={saveProfile}>
          <label>
            Nome
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Celular verificado
            <input value={user.phone} disabled />
          </label>
          <div className="customer-profilePassword">
            <strong>
              {user.has_password ? 'Alterar senha' : 'Criar uma senha'}
            </strong>
            <p>
              Com uma senha, você poderá entrar sem esperar o código no celular.
            </p>
            {user.has_password ? (
              <label>
                Senha atual
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </label>
            ) : null}
            <label>
              Nova senha
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                placeholder="Mínimo de 8 caracteres"
              />
            </label>
          </div>
          <button type="submit" disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar perfil'}
          </button>
        </form>
        {message ? <p className="customer-profileSuccess">{message}</p> : null}
        {error ? <p className="customer-authError">{error}</p> : null}
        <section className="customer-orderHistory" aria-label="Historico de pedidos">
          <div className="customer-orderHistoryHeader">
            <div>
              <span>Meus pedidos</span>
              <h3>Historico por WhatsApp</h3>
            </div>
            {loadingOrders ? <small>Atualizando...</small> : null}
          </div>
          {ordersError ? <p className="customer-authError">{ordersError}</p> : null}
          {!loadingOrders && !ordersError && orders.length === 0 ? (
            <p className="customer-orderEmpty">
              Seus proximos pedidos vao aparecer aqui.
            </p>
          ) : null}
          <div className="customer-orderList">
            {orders.map((order) => {
              const mainItems = order.items
                .slice(0, 2)
                .map((item) => `${item.quantity}x ${item.name}`)
                .join(', ')
              const extraCount = Math.max(order.items.length - 2, 0)
              return (
                <a
                  key={order.order_id}
                  className="customer-orderCard"
                  href={`/pedido/${order.order_id}`}
                >
                  <div>
                    <strong>{statusLabel(order)}</strong>
                    <span>{formatDate(order.created_at)}</span>
                  </div>
                  <p>
                    {mainItems}
                    {extraCount ? ` +${extraCount}` : ''}
                  </p>
                  <small>{formatCurrency(order.total)}</small>
                </a>
              )
            })}
          </div>
        </section>
        <button type="button" className="customer-profileLogout" onClick={logout}>
          Sair da conta
        </button>
      </aside>
    </div>
  )
}
