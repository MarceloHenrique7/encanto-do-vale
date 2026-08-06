import { useEffect, useMemo, useRef, useState } from 'react'
import { FiChevronRight, FiPhone, FiSearch, FiShoppingBag, FiUsers } from 'react-icons/fi'

import { formatCurrency } from '@/lib/formatters'

type CustomerOrder = {
  id: string
  status: string
  restaurant_status?: string
  total: number
  created_at: string
  customer?: {
    address?: string
    number?: string
    neighborhood?: string
    complement?: string
  }
  items: Array<{ id: string; name: string; quantity: number; unit_price: number }>
}

type Customer = {
  id: string
  name: string
  phone: string
  order_count: number
  total_spent: number
  last_order_at: string | null
  orders: CustomerOrder[]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function phoneLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}`
}

function orderStatus(order: CustomerOrder) {
  if (order.restaurant_status === 'completed') return 'Finalizado'
  if (order.restaurant_status === 'cancelled' || order.status === 'failed') return 'Cancelado'
  if (order.restaurant_status === 'ready') return 'Saiu para entrega'
  if (order.restaurant_status === 'preparing') return 'Em preparo'
  return 'Recebido'
}

export default function CustomerManager() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const detailRef = useRef<HTMLElement>(null)

  useEffect(() => {
    fetch('/api/admin/customers')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error ?? 'Não foi possível carregar os clientes.')
        const next = Array.isArray(data.customers) ? data.customers : []
        setCustomers(next)
        setSelectedId((current) => current || next[0]?.id || '')
      })
      .catch((requestError) =>
        setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar clientes.'),
      )
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return customers
    return customers.filter((customer) =>
      `${customer.name} ${customer.phone}`.toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [customers, search])
  const selected = customers.find((customer) => customer.id === selectedId) ?? filtered[0]
  const buyers = customers.filter((customer) => customer.order_count > 0).length

  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedId])

  if (loading) return <section className="store-settingsLoading">Carregando clientes…</section>

  return (
    <section className="customer-manager">
      <header className="customer-managerHero">
        <div>
          <span><FiUsers /></span>
          <div>
            <small>Relacionamento</small>
            <h1>Clientes da loja</h1>
            <p>Cadastros por telefone e compras realmente finalizadas.</p>
          </div>
        </div>
        <div className="customer-managerMetrics">
          <span><strong>{customers.length}</strong><small>cadastrados</small></span>
          <span><strong>{buyers}</strong><small>já compraram</small></span>
        </div>
      </header>
      {error ? <p className="manager-error">{error}</p> : null}
      <div className="customer-managerWorkspace">
        <aside>
          <label><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome ou telefone" /></label>
          <div className="customer-managerList">
            {filtered.map((customer) => (
              <button
                type="button"
                className={selected?.id === customer.id ? 'is-active' : ''}
                key={customer.id}
                onClick={() => setSelectedId(customer.id)}
              >
                <span className="customer-managerAvatar">{customer.name?.charAt(0).toUpperCase() || 'C'}</span>
                <span>
                  <strong>{customer.name || 'Cliente'}</strong>
                  <small>{customer.phone}</small>
                  <em>{customer.order_count} pedido(s) finalizado(s)</em>
                </span>
                <FiChevronRight />
              </button>
            ))}
            {!filtered.length ? <p>Nenhum cliente encontrado.</p> : null}
          </div>
        </aside>
        {selected ? (
          <section className="customer-managerDetail" ref={detailRef}>
            <header>
              <div>
                <span className="customer-managerAvatar is-large">{selected.name?.charAt(0).toUpperCase() || 'C'}</span>
                <div><h2>{selected.name || 'Cliente'}</h2><p>{selected.phone}</p></div>
              </div>
              {selected.phone ? <a href={phoneLink(selected.phone)} target="_blank" rel="noreferrer"><FiPhone /> WhatsApp</a> : null}
            </header>
            <div className="customer-managerSummary">
              <span><strong>{selected.order_count}</strong><small>pedidos</small></span>
              <span><strong>{formatCurrency(selected.total_spent)}</strong><small>total em compras</small></span>
              <span><strong>{selected.last_order_at ? formatDate(selected.last_order_at) : '—'}</strong><small>último pedido</small></span>
            </div>
            <div className="customer-managerOrders">
              <div className="customer-managerOrdersTitle"><FiShoppingBag /><strong>Pedidos finalizados</strong></div>
              {selected.orders.map((order) => (
                <article key={order.id}>
                  <header>
                    <span><strong>#{order.id.slice(0, 8)}</strong><small>{formatDate(order.created_at)}</small></span>
                    <span><b>{orderStatus(order)}</b><strong>{formatCurrency(order.total)}</strong></span>
                  </header>
                  <div>{order.items.map((item) => <p key={`${order.id}-${item.id}`}>{item.quantity}× {item.name} <span>{formatCurrency(item.quantity * item.unit_price)}</span></p>)}</div>
                  {order.customer?.address ? (
                    <footer>{order.customer.address}, {order.customer.number} — {order.customer.neighborhood}{order.customer.complement ? `, ${order.customer.complement}` : ''}</footer>
                  ) : null}
                </article>
              ))}
              {!selected.orders.length ? <p className="customer-managerEmpty">Este cliente ainda não possui pedidos finalizados.</p> : null}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  )
}
