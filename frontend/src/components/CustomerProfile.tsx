import { FormEvent, useEffect, useState } from 'react'
import { FiAward, FiGift, FiMapPin, FiPlus, FiTag, FiTrash2 } from 'react-icons/fi'

import type { CustomerUser } from '@/components/CustomerAuthGate'

type CustomerProfileProps = {
  user: CustomerUser
  isOpen: boolean
  initialView?: 'profile' | 'rewards'
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

type SavedAddress = {
  id: string
  label: string
  recipientName: string
  phone: string
  address: string
  number: string
  neighborhood: string
  complement: string
  isDefault: boolean
}

const emptyAddress = {
  label: 'Casa',
  address: '',
  number: '',
  neighborhood: '',
  complement: '',
}

type LoyaltyData = {
  settings: { points: number; amount: number; validityDays: number; enabled: boolean }
  account: { currentBalance: number; pendingBalance: number }
  rewards: Array<{
    id: string
    name: string
    description: string
    imageSrc: string
    pointsCost: number
    stock: number | null
  }>
  transactions: Array<{
    id: string
    type: string
    points: number
    description: string
    expires_at?: string
    created_at: string
  }>
  redemptions: Array<{
    id: string
    code: string
    reward_id: string
    status: string
    created_at: string
  }>
}

type CampaignAssignment = {
  campaign: {
    id: string
    name: string
    type: 'voucher' | 'coupon' | 'gift' | 'announcement'
    headline: string
    description: string
    benefit: string
    partnerName: string
    imageSrc: string
    instructions: string
    terms: string
    endAt?: string
    publicCouponCode?: string
  }
  voucher: {
    id: string
    code: string
    status: 'available' | 'used'
    source?: 'distributed' | 'public'
    createdAt: string
  }
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
  initialView = 'profile',
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
  const [loyalty, setLoyalty] = useState<LoyaltyData | null>(null)
  const [loyaltyError, setLoyaltyError] = useState('')
  const [redeemingId, setRedeemingId] = useState('')
  const [campaigns, setCampaigns] = useState<CampaignAssignment[]>([])
  const [campaignError, setCampaignError] = useState('')
  const [copiedCode, setCopiedCode] = useState('')
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [addressForm, setAddressForm] = useState(emptyAddress)
  const [addressMessage, setAddressMessage] = useState('')
  const [addressError, setAddressError] = useState('')
  const [savingAddress, setSavingAddress] = useState(false)
  const [deletingAddressId, setDeletingAddressId] = useState('')

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
    fetch('/api/loyalty')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error ?? 'Não foi possível carregar seus pontos.')
        if (active) setLoyalty(data)
      })
      .catch((requestError) => {
        if (active) {
          setLoyaltyError(
            requestError instanceof Error
              ? requestError.message
              : 'Não foi possível carregar seus pontos.',
          )
        }
      })
    fetch('/api/campaigns')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.error ?? 'Não foi possível carregar seus benefícios.')
        }
        if (active) {
          setCampaigns(Array.isArray(data.assignments) ? data.assignments : [])
        }
      })
      .catch((requestError) => {
        if (active) {
          setCampaignError(
            requestError instanceof Error
              ? requestError.message
              : 'Não foi possível carregar seus benefícios.',
          )
        }
      })
      .catch((requestError) => {
        if (active) setLoyaltyError(
          requestError instanceof Error ? requestError.message : 'Não foi possível carregar seus pontos.',
        )
      })

    fetch('/api/addresses')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.error ?? 'Não foi possível carregar seus endereços.')
        }
        if (active) {
          setAddresses(Array.isArray(data.addresses) ? data.addresses : [])
        }
      })
      .catch((requestError) => {
        if (active) {
          setAddressError(
            requestError instanceof Error
              ? requestError.message
              : 'Não foi possível carregar seus endereços.',
          )
        }
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

  async function saveAddress(event: FormEvent) {
    event.preventDefault()
    setSavingAddress(true)
    setAddressMessage('')
    setAddressError('')
    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...addressForm,
          recipientName: name || user.name,
          phone: user.phone,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível salvar o endereço.')
      }
      setAddresses((current) => [
        data.address,
        ...current.filter((address) => address.id !== data.address.id),
      ])
      setAddressForm(emptyAddress)
      setAddressMessage('Endereço salvo. Ele já estará disponível no checkout.')
    } catch (requestError) {
      setAddressError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível salvar o endereço.',
      )
    } finally {
      setSavingAddress(false)
    }
  }

  async function deleteAddress(address: SavedAddress) {
    if (!window.confirm(`Excluir o endereço “${address.label}”?`)) return
    setDeletingAddressId(address.id)
    setAddressMessage('')
    setAddressError('')
    try {
      const response = await fetch(`/api/addresses/${address.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? 'Não foi possível excluir o endereço.')
      }
      setAddresses((current) =>
        current.filter((item) => item.id !== address.id),
      )
      setAddressMessage('Endereço excluído.')
    } catch (requestError) {
      setAddressError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível excluir o endereço.',
      )
    } finally {
      setDeletingAddressId('')
    }
  }

  async function redeem(rewardId: string, rewardName: string) {
    if (!window.confirm(`Resgatar “${rewardName}” com seus pontos?`)) return
    setRedeemingId(rewardId)
    setLoyaltyError('')
    try {
      const response = await fetch('/api/loyalty/redemptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível resgatar.')
      const refreshed = await fetch('/api/loyalty').then((result) => result.json())
      setLoyalty(refreshed)
      setMessage(`Recompensa resgatada. Código: ${data.redemption.code}`)
    } catch (requestError) {
      setLoyaltyError(
        requestError instanceof Error ? requestError.message : 'Não foi possível resgatar.',
      )
    } finally {
      setRedeemingId('')
    }
  }

  const nextReward = loyalty?.rewards
    .filter((reward) => reward.pointsCost > loyalty.account.currentBalance)
    .sort((a, b) => a.pointsCost - b.pointsCost)[0]

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
            <span>{initialView === 'rewards' ? 'Clube de Fidelidade' : 'Minha conta'}</span>
            <h2>
              {initialView === 'rewards'
                ? 'Pontos e presentes'
                : `Olá, ${user.name.split(' ')[0]}`}
            </h2>
          </div>
          <button type="button" onClick={onClose}>Fechar</button>
        </div>
        {loyalty?.settings.enabled ? (
          <section className="loyalty-wallet">
            <header>
              <span><FiAward /></span>
              <div><small>Clube de Fidelidade</small><h3>Meus Pontos</h3></div>
              <strong>{loyalty.account.currentBalance}<small> pontos</small></strong>
            </header>
            <p>
              Você ganha {loyalty.settings.points} ponto(s) a cada {formatCurrency(loyalty.settings.amount)}
              {' '}gasto em produtos. Os pontos são liberados quando o pedido é finalizado.
            </p>
            {nextReward ? (
              <div className="loyalty-progress">
                <div><span>Próxima recompensa</span><strong>Faltam {nextReward.pointsCost - loyalty.account.currentBalance} pontos</strong></div>
                <progress value={loyalty.account.currentBalance} max={nextReward.pointsCost} />
              </div>
            ) : null}
            <div className="loyalty-rewardList">
              {loyalty.rewards.map((reward) => (
                <article key={reward.id}>
                  <span>{reward.imageSrc ? <img src={reward.imageSrc} alt="" /> : <FiGift />}</span>
                  <div><strong>{reward.name}</strong><small>{reward.description}</small><b>{reward.pointsCost} pontos</b></div>
                  <button
                    type="button"
                    disabled={loyalty.account.currentBalance < reward.pointsCost || redeemingId === reward.id}
                    onClick={() => redeem(reward.id, reward.name)}
                  >
                    {redeemingId === reward.id ? 'Resgatando…' : 'Resgatar'}
                  </button>
                </article>
              ))}
            </div>
            {loyalty.redemptions.length ? (
              <div className="loyalty-codes">
                <strong>Meus resgates</strong>
                {loyalty.redemptions.slice(0, 4).map((redemption) => (
                  <div key={redemption.id}><code>{redemption.code}</code><span>{redemption.status === 'available' ? 'Disponível' : 'Utilizado'}</span></div>
                ))}
              </div>
            ) : null}
            {loyalty.transactions.length ? (
              <details className="loyalty-history">
                <summary>Ver histórico de pontos</summary>
                {loyalty.transactions.slice(0, 12).map((transaction) => (
                  <div key={transaction.id}>
                    <span>{transaction.description}</span>
                    <strong className={transaction.points > 0 ? 'is-credit' : ''}>{transaction.points > 0 ? '+' : ''}{transaction.points}</strong>
                  </div>
                ))}
              </details>
            ) : null}
          </section>
        ) : null}
        {loyaltyError ? <p className="customer-authError">{loyaltyError}</p> : null}
        {initialView === 'profile' && campaigns.length ? (
          <section className="customer-campaignWallet">
            <header>
              <span><FiTag /></span>
              <div><small>Benefícios exclusivos</small><h3>Meus vouchers e cupons</h3></div>
              <strong>{campaigns.filter(({ voucher }) => voucher.status === 'available').length}</strong>
            </header>
            <div className="customer-campaignList">
              {campaigns.map(({ campaign, voucher }) => (
                <article
                  className={voucher.status === 'used' ? 'is-used' : ''}
                  key={voucher.id}
                >
                  {campaign.imageSrc ? (
                    <img src={campaign.imageSrc} alt="" loading="lazy" />
                  ) : null}
                  <div>
                    <span>{campaign.partnerName || 'Encanto do Vale'}</span>
                    <h4>{campaign.headline || campaign.name}</h4>
                    <p>{campaign.benefit}</p>
                    {campaign.description ? <small>{campaign.description}</small> : null}
                  </div>
                  <div className="customer-campaignCode">
                    <span>{voucher.status === 'available' ? 'Seu código' : 'Código utilizado'}</span>
                    <code>{voucher.code}</code>
                    {voucher.status === 'available' ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(voucher.code)
                          setCopiedCode(voucher.code)
                        }}
                      >
                        {copiedCode === voucher.code ? 'Copiado!' : 'Copiar código'}
                      </button>
                    ) : null}
                  </div>
                  {campaign.instructions ? (
                    <p className="customer-campaignInstructions">
                      <strong>Como usar:</strong> {campaign.instructions}
                    </p>
                  ) : null}
                  {campaign.terms ? <small className="customer-campaignTerms">{campaign.terms}</small> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
        {campaignError ? <p className="customer-authError">{campaignError}</p> : null}
        {initialView === 'profile' ? (
          <section className="customer-addressBook">
            <header>
              <span><FiMapPin /></span>
              <div>
                <small>Entrega mais rápida</small>
                <h3>Meus endereços</h3>
              </div>
              <strong>{addresses.length}</strong>
            </header>
            {addresses.length ? (
              <div className="customer-addressList">
                {addresses.map((address) => (
                  <article key={address.id}>
                    <div>
                      <span>
                        <strong>{address.label}</strong>
                        {address.isDefault ? <small>Principal</small> : null}
                      </span>
                      <p>{address.address}, {address.number}</p>
                      <small>
                        {address.neighborhood}
                        {address.complement ? ` · ${address.complement}` : ''}
                      </small>
                    </div>
                    <button
                      type="button"
                      aria-label={`Excluir endereço ${address.label}`}
                      disabled={deletingAddressId === address.id}
                      onClick={() => deleteAddress(address)}
                    >
                      <FiTrash2 />
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="customer-addressEmpty">
                Cadastre casa, trabalho ou outro local para preencher o checkout
                com um toque.
              </p>
            )}
            <details className="customer-newAddress">
              <summary><FiPlus /> Cadastrar novo endereço</summary>
              <form onSubmit={saveAddress}>
                <label>
                  Nome do endereço
                  <input
                    value={addressForm.label}
                    maxLength={30}
                    placeholder="Casa, Trabalho..."
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        label: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Endereço
                  <input
                    value={addressForm.address}
                    placeholder="Rua, avenida ou condomínio"
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        address: event.target.value,
                      }))
                    }
                  />
                </label>
                <div>
                  <label>
                    Número
                    <input
                      value={addressForm.number}
                      placeholder="Nº"
                      onChange={(event) =>
                        setAddressForm((current) => ({
                          ...current,
                          number: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Bairro
                    <input
                      value={addressForm.neighborhood}
                      placeholder="Seu bairro"
                      onChange={(event) =>
                        setAddressForm((current) => ({
                          ...current,
                          neighborhood: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label>
                  Complemento
                  <input
                    value={addressForm.complement}
                    placeholder="Apartamento, bloco ou referência"
                    onChange={(event) =>
                      setAddressForm((current) => ({
                        ...current,
                        complement: event.target.value,
                      }))
                    }
                  />
                </label>
                <button type="submit" disabled={savingAddress}>
                  {savingAddress ? 'Salvando…' : 'Salvar endereço'}
                </button>
              </form>
            </details>
            {addressMessage ? (
              <p className="customer-profileSuccess">{addressMessage}</p>
            ) : null}
            {addressError ? (
              <p className="customer-authError">{addressError}</p>
            ) : null}
            <p className="customer-addressPrivacy">
              Não armazenamos número, código de segurança ou outros dados de cartão.
            </p>
          </section>
        ) : null}
        {initialView === 'profile' ? <form onSubmit={saveProfile}>
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
        </form> : null}
        {message ? <p className="customer-profileSuccess">{message}</p> : null}
        {error ? <p className="customer-authError">{error}</p> : null}
        {initialView === 'profile' ? <section className="customer-orderHistory" aria-label="Historico de pedidos">
          <div className="customer-orderHistoryHeader">
            <div>
              <span>Meus pedidos</span>
              <h3>Pedidos finalizados</h3>
            </div>
            {loadingOrders ? <small>Atualizando...</small> : null}
          </div>
          {ordersError ? <p className="customer-authError">{ordersError}</p> : null}
          {!loadingOrders && !ordersError && orders.length === 0 ? (
            <p className="customer-orderEmpty">
              Seus pedidos aparecerão aqui depois que forem finalizados.
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
        </section> : null}
        {initialView === 'profile' ? <button type="button" className="customer-profileLogout" onClick={logout}>
          Sair da conta
        </button> : null}
      </aside>
    </div>
  )
}
