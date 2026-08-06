import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  FiAward,
  FiCheck,
  FiClock,
  FiGift,
  FiPlus,
  FiSearch,
  FiTrendingUp,
  FiUsers,
} from 'react-icons/fi'

type Settings = {
  enabled: boolean
  points: number
  amount: number
  validityDays: number
  minimumOrder: number
  releaseStatus: string
}

type Reward = {
  id: string
  name: string
  description: string
  imageSrc: string
  pointsCost: number
  active: boolean
  validFrom: string
  validUntil: string
  stock: number | null
  perCustomerLimit: number
  minimumOrder: number
  productId: string
  instructions: string
}

type Account = {
  customer_id: string
  current_balance: number
  pending_balance: number
  name?: string
  phone?: string
}

const emptyReward: Reward = {
  id: '',
  name: '',
  description: '',
  imageSrc: '',
  pointsCost: 100,
  active: true,
  validFrom: '',
  validUntil: '',
  stock: 100,
  perCustomerLimit: 1,
  minimumOrder: 0,
  productId: '',
  instructions: '',
}

export default function LoyaltyManager() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [rewards, setRewards] = useState<Reward[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Array<{
    id: string; customer_id: string; order_id?: string; type: string; points: number; description: string; created_at: string
  }>>([])
  const [redemptions, setRedemptions] = useState<Array<{
    id: string; code: string; customer_id: string; reward_id: string; status: string; created_at: string
  }>>([])
  const [reward, setReward] = useState<Reward>(emptyReward)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
  const [adjustment, setAdjustment] = useState({ customerId: '', points: '', description: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    try {
      const response = await fetch('/api/admin/loyalty')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível carregar o clube.')
      setSettings(data.settings)
      setRewards(data.rewards ?? [])
      const nextAccounts: Account[] = data.accounts ?? []
      setAccounts(nextAccounts)
      setTransactions(data.transactions ?? [])
      setRedemptions(data.redemptions ?? [])
      setAdjustment((current) => ({
        ...current,
        customerId:
          current.customerId || nextAccounts[0]?.customer_id || '',
      }))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar.')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const rankedAccounts = useMemo(
    () =>
      [...accounts].sort(
        (first, second) =>
          Number(second.current_balance) - Number(first.current_balance) ||
          String(first.name ?? '').localeCompare(
            String(second.name ?? ''),
            'pt-BR',
          ),
      ),
    [accounts],
  )

  const filteredAccounts = useMemo(() => {
    const term = search.toLocaleLowerCase('pt-BR')
    return rankedAccounts.filter((account) =>
      `${account.name ?? ''} ${account.phone ?? ''}`.toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [rankedAccounts, search])
  const rankByCustomer = useMemo(
    () =>
      new Map(
        rankedAccounts.map((account, index) => [
          account.customer_id,
          index + 1,
        ]),
      ),
    [rankedAccounts],
  )
  const selectedAccount =
    rankedAccounts.find(
      (account) => account.customer_id === adjustment.customerId,
    ) ?? rankedAccounts[0]
  const selectedTransactions = selectedAccount
    ? transactions.filter(
        (transaction) =>
          transaction.customer_id === selectedAccount.customer_id,
      )
    : []
  const earnedPoints = selectedTransactions
    .filter((transaction) => transaction.points > 0)
    .reduce((total, transaction) => total + transaction.points, 0)
  const usedPoints = Math.abs(
    selectedTransactions
      .filter((transaction) => transaction.points < 0)
      .reduce((total, transaction) => total + transaction.points, 0),
  )

  async function saveSettings(event: FormEvent) {
    event.preventDefault()
    if (!settings) return
    const response = await fetch('/api/admin/loyalty/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error)
    setSettings(data.settings)
    setMessage('Regra de pontuação atualizada.')
  }

  async function saveReward(event: FormEvent) {
    event.preventDefault()
    const response = await fetch(
      editingId ? `/api/admin/loyalty/rewards/${editingId}` : '/api/admin/loyalty/rewards',
      {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reward),
      },
    )
    const data = await response.json()
    if (!response.ok) return setError(data.error)
    setEditingId(data.reward.id)
    setReward(data.reward)
    setMessage('Recompensa salva.')
    await load()
  }

  async function adjust(event: FormEvent) {
    event.preventDefault()
    const response = await fetch('/api/admin/loyalty/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: adjustment.customerId,
        points: Number(adjustment.points),
        description: adjustment.description,
      }),
    })
    const data = await response.json()
    if (!response.ok) return setError(data.error)
    setAdjustment((current) => ({
      customerId: current.customerId,
      points: '',
      description: '',
    }))
    setMessage('Ajuste registrado no histórico.')
    await load()
  }

  async function removeReward() {
    if (!editingId || !window.confirm('Excluir esta recompensa?')) return
    const response = await fetch(`/api/admin/loyalty/rewards/${editingId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      return setError(data.error ?? 'Não foi possível excluir.')
    }
    setEditingId('')
    setReward(emptyReward)
    setMessage('Recompensa excluída.')
    await load()
  }

  if (!settings) return <section className="store-settingsLoading">{error || 'Carregando clube de fidelidade…'}</section>

  return (
    <section className="loyalty-manager">
      <header className="loyalty-managerHero">
        <div><span><FiAward /></span><div><small>Relacionamento</small><h1>Clube de Fidelidade</h1><p>Pontuação, recompensas e saldos dos clientes em um só lugar.</p></div></div>
        <label><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })} /> Programa ativo</label>
      </header>
      {message ? <p className="store-settingsSuccess">{message}</p> : null}
      {error ? <p className="manager-error">{error}</p> : null}

      <form className="loyalty-settingsCard" onSubmit={saveSettings}>
        <header><div><strong>Regra de pontuação</strong><small>Crédito liberado somente quando o pedido for finalizado.</small></div><button>Salvar regra</button></header>
        <div>
          <label><span>Pontos gerados</span><input type="number" min="1" value={settings.points} onChange={(event) => setSettings({ ...settings, points: Number(event.target.value) })} /></label>
          <label><span>A cada valor (R$)</span><input type="number" min=".01" step=".01" value={settings.amount} onChange={(event) => setSettings({ ...settings, amount: Number(event.target.value) })} /></label>
          <label><span>Validade em dias</span><input type="number" min="1" value={settings.validityDays} onChange={(event) => setSettings({ ...settings, validityDays: Number(event.target.value) })} /></label>
          <label><span>Pedido mínimo (R$)</span><input type="number" min="0" step=".01" value={settings.minimumOrder} onChange={(event) => setSettings({ ...settings, minimumOrder: Number(event.target.value) })} /></label>
          <label><span>Liberar pontos em</span><select value={settings.releaseStatus} onChange={(event) => setSettings({ ...settings, releaseStatus: event.target.value })}><option value="completed">Pedido finalizado</option><option value="ready">Saiu para entrega</option></select></label>
        </div>
      </form>

      <section className="loyalty-rewardManager">
        <header><div><FiGift /><span><strong>Catálogo de recompensas</strong><small>{rewards.length} recompensa(s)</small></span></div><button type="button" onClick={() => { setEditingId(''); setReward(emptyReward) }}><FiPlus /> Nova recompensa</button></header>
        <div className="loyalty-rewardWorkspace">
          <div className="loyalty-adminRewardList">
            {rewards.map((item) => <button type="button" className={editingId === item.id ? 'is-active' : ''} key={item.id} onClick={() => { setEditingId(item.id); setReward(item) }}><FiGift /><span><strong>{item.name}</strong><small>{item.pointsCost} pontos · {item.stock ?? '∞'} disponíveis</small></span></button>)}
          </div>
          <form onSubmit={saveReward} className="loyalty-rewardForm">
            <div className="catalog-managerFields">
              <label className="is-wide"><span>Nome</span><input required value={reward.name} onChange={(event) => setReward({ ...reward, name: event.target.value, id: editingId ? reward.id : event.target.value.toLowerCase().replace(/\W+/g, '-') })} /></label>
              <label className="is-wide"><span>Descrição</span><textarea rows={2} value={reward.description} onChange={(event) => setReward({ ...reward, description: event.target.value })} /></label>
              <label><span>Custo em pontos</span><input type="number" min="1" value={reward.pointsCost} onChange={(event) => setReward({ ...reward, pointsCost: Number(event.target.value) })} /></label>
              <label><span>Estoque</span><input type="number" min="0" value={reward.stock ?? ''} onChange={(event) => setReward({ ...reward, stock: event.target.value === '' ? null : Number(event.target.value) })} /></label>
              <label><span>Limite por cliente</span><input type="number" min="1" value={reward.perCustomerLimit} onChange={(event) => setReward({ ...reward, perCustomerLimit: Number(event.target.value) })} /></label>
              <label><span>Compra mínima</span><input type="number" min="0" step=".01" value={reward.minimumOrder} onChange={(event) => setReward({ ...reward, minimumOrder: Number(event.target.value) })} /></label>
              <label><span>Válida a partir de</span><input type="date" value={reward.validFrom?.slice(0, 10)} onChange={(event) => setReward({ ...reward, validFrom: event.target.value })} /></label>
              <label><span>Válida até</span><input type="date" value={reward.validUntil?.slice(0, 10)} onChange={(event) => setReward({ ...reward, validUntil: event.target.value })} /></label>
              <label className="is-wide"><span>ID do produto presenteado (opcional)</span><input value={reward.productId} onChange={(event) => setReward({ ...reward, productId: event.target.value })} placeholder="Ex.: brigadeiro-tradicional" /></label>
              <label className="is-wide"><span>Imagem opcional</span><input value={reward.imageSrc} onChange={(event) => setReward({ ...reward, imageSrc: event.target.value })} /></label>
              <label className="is-wide"><span>Instruções</span><textarea rows={2} value={reward.instructions} onChange={(event) => setReward({ ...reward, instructions: event.target.value })} /></label>
              <label className="loyalty-activeToggle is-wide"><input type="checkbox" checked={reward.active} onChange={(event) => setReward({ ...reward, active: event.target.checked })} /> Recompensa ativa</label>
            </div>
            <div className="catalog-categoryActions">
              <button className="manager-primaryAction"><FiCheck /> Salvar recompensa</button>
              {editingId ? <button type="button" className="is-danger" onClick={removeReward}>Excluir</button> : null}
            </div>
          </form>
        </div>
      </section>

      <section className="loyalty-customerManager">
        <header><div><strong>Ranking de clientes</strong><small>Classificação pelo saldo de pontos disponível.</small></div><label><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome ou telefone" /></label></header>
        {rankedAccounts.length ? (
          <div className="loyalty-rankingPodium">
            {rankedAccounts.slice(0, 3).map((account, index) => (
              <button
                type="button"
                className={`is-position-${index + 1}${
                  selectedAccount?.customer_id === account.customer_id
                    ? ' is-selected'
                    : ''
                }`}
                key={account.customer_id}
                onClick={() =>
                  setAdjustment({
                    ...adjustment,
                    customerId: account.customer_id,
                  })
                }
              >
                <span>#{index + 1}</span>
                <b>{account.name?.charAt(0).toUpperCase() || 'C'}</b>
                <strong>{account.name || 'Cliente'}</strong>
                <small>{account.current_balance} pontos</small>
              </button>
            ))}
          </div>
        ) : null}
        <div className="loyalty-customerGrid">
          <div className="loyalty-rankingList">
            {filteredAccounts.map((account) => (
              <button
                type="button"
                className={
                  selectedAccount?.customer_id === account.customer_id
                    ? 'is-active'
                    : ''
                }
                key={account.customer_id}
                onClick={() =>
                  setAdjustment({
                    ...adjustment,
                    customerId: account.customer_id,
                  })
                }
              >
                <em>#{rankByCustomer.get(account.customer_id)}</em>
                <span>
                  <strong>{account.name || 'Cliente'}</strong>
                  <small>{account.phone || account.customer_id}</small>
                </span>
                <b>{account.current_balance} pts</b>
              </button>
            ))}
            {!filteredAccounts.length ? (
              <p>Nenhum cliente encontrado.</p>
            ) : null}
          </div>
          {selectedAccount ? (
            <div className="loyalty-customerDetail">
              <header>
                <div>
                  <span>{selectedAccount.name?.charAt(0).toUpperCase() || 'C'}</span>
                  <div>
                    <small>#{rankByCustomer.get(selectedAccount.customer_id)} no ranking</small>
                    <h3>{selectedAccount.name || 'Cliente'}</h3>
                    <p>{selectedAccount.phone}</p>
                  </div>
                </div>
                <FiTrendingUp />
              </header>
              <div className="loyalty-customerMetrics">
                <span><FiAward /><strong>{selectedAccount.current_balance}</strong><small>saldo disponível</small></span>
                <span><FiClock /><strong>{selectedAccount.pending_balance}</strong><small>saldo pendente</small></span>
                <span><FiTrendingUp /><strong>{earnedPoints}</strong><small>pontos recebidos</small></span>
                <span><FiGift /><strong>{usedPoints}</strong><small>pontos utilizados</small></span>
              </div>
              <form onSubmit={adjust}>
                <div>
                  <FiUsers />
                  <span><strong>Ajuste manual</strong><small>O registro ficará no histórico do cliente.</small></span>
                </div>
                <input required type="number" placeholder="+50 para crédito ou -20 para débito" value={adjustment.points} onChange={(event) => setAdjustment({ ...adjustment, points: event.target.value })} />
                <textarea required rows={2} placeholder="Justificativa obrigatória" value={adjustment.description} onChange={(event) => setAdjustment({ ...adjustment, description: event.target.value })} />
                <button className="manager-primaryAction">Registrar ajuste</button>
              </form>
              <section className="loyalty-customerTimeline">
                <header><strong>Movimentações recentes</strong><small>{selectedTransactions.length} registro(s)</small></header>
                {selectedTransactions.slice(0, 10).map((transaction) => (
                  <article key={transaction.id}>
                    <span><strong>{transaction.description}</strong><small>{transaction.order_id ? `Pedido #${transaction.order_id.slice(0, 8)}` : transaction.type}</small></span>
                    <b className={transaction.points > 0 ? 'is-credit' : ''}>{transaction.points > 0 ? '+' : ''}{transaction.points}</b>
                  </article>
                ))}
                {!selectedTransactions.length ? <p>Este cliente ainda não possui movimentações.</p> : null}
              </section>
            </div>
          ) : (
            <div className="loyalty-customerEmpty">Nenhum cliente cadastrado.</div>
          )}
        </div>
      </section>
      <section className="loyalty-activity">
        <header><div><strong>Movimentações e resgates</strong><small>Histórico auditável das operações mais recentes.</small></div></header>
        <div>
          <section>
            <h3>Pontos</h3>
            {transactions.slice(0, 20).map((transaction) => (
              <article key={transaction.id}>
                <span><strong>{transaction.description}</strong><small>{transaction.order_id ? `Pedido #${transaction.order_id.slice(0, 8)}` : transaction.type}</small></span>
                <b className={transaction.points > 0 ? 'is-credit' : ''}>{transaction.points > 0 ? '+' : ''}{transaction.points}</b>
              </article>
            ))}
          </section>
          <section>
            <h3>Resgates</h3>
            {redemptions.slice(0, 20).map((redemption) => (
              <article key={redemption.id}>
                <span><strong>{redemption.code}</strong><small>{redemption.reward_id}</small></span>
                <b>{redemption.status}</b>
              </article>
            ))}
          </section>
        </div>
      </section>
    </section>
  )
}
