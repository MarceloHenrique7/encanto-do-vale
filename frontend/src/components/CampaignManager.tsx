import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  FiCheckCircle,
  FiGift,
  FiSend,
  FiTag,
  FiTrash2,
  FiUsers,
} from 'react-icons/fi'

type Campaign = {
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
  active: boolean
  startAt: string
  endAt: string
  codePrefix: string
  perCustomerLimit: number
  autoDistributeCompletedOrders: boolean
  publicCouponCode: string
  discountType: 'fixed' | 'percentage' | 'free_delivery'
  discountValue: number
  minimumOrder: number
  maxDiscount: number | null
  showInHero: boolean
}

type Voucher = {
  id: string
  campaignId: string
  customerId: string
  customerName?: string
  customerPhone?: string
  code: string
  status: 'available' | 'used' | 'cancelled'
  createdAt: string
}

type Customer = {
  id: string
  name: string
  phone: string
  order_count: number
}

const emptyCampaign: Campaign = {
  id: '',
  name: '',
  type: 'voucher',
  headline: '',
  description: '',
  benefit: '',
  partnerName: '',
  imageSrc: '',
  instructions: '',
  terms: '',
  active: true,
  startAt: '',
  endAt: '',
  codePrefix: 'VALE',
  perCustomerLimit: 1,
  autoDistributeCompletedOrders: false,
  publicCouponCode: '',
  discountType: 'fixed',
  discountValue: 10,
  minimumOrder: 0,
  maxDiscount: null,
  showInHero: false,
}

const typeLabels: Record<Campaign['type'], string> = {
  voucher: 'Voucher de parceiro',
  coupon: 'Cupom promocional',
  gift: 'Presente ou brinde',
  announcement: 'Comunicado',
}

function dateInput(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export default function CampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [form, setForm] = useState<Campaign>(emptyCampaign)
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set())
  const [customerSearch, setCustomerSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const [campaignResponse, customerResponse] = await Promise.all([
        fetch('/api/admin/campaigns'),
        fetch('/api/admin/customers'),
      ])
      const [campaignData, customerData] = await Promise.all([
        campaignResponse.json().catch(() => ({})),
        customerResponse.json().catch(() => ({})),
      ])
      if (!campaignResponse.ok) {
        throw new Error(campaignData.error ?? 'Não foi possível carregar as campanhas.')
      }
      if (!customerResponse.ok) {
        throw new Error(customerData.error ?? 'Não foi possível carregar os clientes.')
      }
      setCampaigns(campaignData.campaigns ?? [])
      setVouchers(campaignData.vouchers ?? [])
      setCustomers(customerData.customers ?? [])
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível carregar as campanhas.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const campaignVouchers = useMemo(
    () => vouchers.filter((voucher) => voucher.campaignId === selectedId),
    [selectedId, vouchers],
  )
  const featuredCampaignCount = useMemo(
    () =>
      campaigns.filter(
        (campaign) =>
          campaign.active &&
          campaign.showInHero &&
          campaign.id !== selectedId,
      ).length,
    [campaigns, selectedId],
  )
  const eligibleCustomers = useMemo(() => {
    const term = customerSearch.trim().toLocaleLowerCase('pt-BR')
    return customers.filter(
      (customer) =>
        customer.order_count > 0 &&
        (!term ||
          `${customer.name} ${customer.phone}`
            .toLocaleLowerCase('pt-BR')
            .includes(term)),
    )
  }, [customerSearch, customers])

  function selectCampaign(campaign: Campaign) {
    setSelectedId(campaign.id)
    setForm({
      ...emptyCampaign,
      ...campaign,
      startAt: dateInput(campaign.startAt),
      endAt: dateInput(campaign.endAt),
    })
    setSelectedCustomers(new Set())
    setMessage('')
    setError('')
  }

  function newCampaign() {
    setSelectedId('')
    setForm(emptyCampaign)
    setSelectedCustomers(new Set())
    setMessage('')
    setError('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(
        selectedId
          ? `/api/admin/campaigns/${encodeURIComponent(selectedId)}`
          : '/api/admin/campaigns',
        {
          method: selectedId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível salvar.')
      await load()
      selectCampaign(data.campaign)
      setMessage('Campanha salva com sucesso.')
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

  async function distribute(customerIds: string[]) {
    if (!selectedId || !customerIds.length) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch(
        `/api/admin/campaigns/${encodeURIComponent(selectedId)}/distribute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerIds }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível distribuir os vouchers.')
      }
      await load()
      setSelectedCustomers(new Set())
      setMessage(
        data.distributed
          ? `${data.distributed} voucher(es) distribuído(s).`
          : 'Nenhum novo voucher foi criado; os clientes selecionados já atingiram o limite.',
      )
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível distribuir os vouchers.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function setVoucherStatus(voucherId: string, status: Voucher['status']) {
    const response = await fetch(
      `/api/admin/campaign-vouchers/${encodeURIComponent(voucherId)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      },
    )
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(data.error ?? 'Não foi possível atualizar o voucher.')
      return
    }
    setVouchers((current) =>
      current.map((voucher) =>
        voucher.id === voucherId ? { ...voucher, status } : voucher,
      ),
    )
  }

  async function remove() {
    if (!selectedId || !window.confirm('Excluir esta campanha sem vouchers?')) return
    const response = await fetch(
      `/api/admin/campaigns/${encodeURIComponent(selectedId)}`,
      { method: 'DELETE' },
    )
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      setError(data.error ?? 'Não foi possível excluir a campanha.')
      return
    }
    await load()
    newCampaign()
  }

  if (loading && !campaigns.length) {
    return <section className="store-settingsLoading">Carregando campanhas…</section>
  }

  return (
    <section className="campaign-manager">
      <header className="campaign-managerHero">
        <div>
          <span><FiTag /></span>
          <div>
            <small>Marketing e relacionamento</small>
            <h1>Campanhas</h1>
            <p>Crie ações, vouchers, cupons e presentes para seus clientes.</p>
          </div>
        </div>
        <div className="campaign-managerMetrics">
          <span><strong>{campaigns.length}</strong><small>campanhas</small></span>
          <span>
            <strong>{vouchers.filter((voucher) => voucher.status === 'available').length}</strong>
            <small>vouchers disponíveis</small>
          </span>
        </div>
      </header>

      {message ? <p className="campaign-managerMessage">{message}</p> : null}
      {error ? <p className="manager-error">{error}</p> : null}

      <div className="campaign-managerWorkspace">
        <aside className="campaign-managerList">
          <button type="button" className={!selectedId ? 'is-active' : ''} onClick={newCampaign}>
            <FiGift /><span><strong>Nova campanha</strong><small>Criar uma ação</small></span>
          </button>
          {campaigns.map((campaign) => (
            <button
              type="button"
              className={selectedId === campaign.id ? 'is-active' : ''}
              key={campaign.id}
              onClick={() => selectCampaign(campaign)}
            >
              <FiTag />
              <span><strong>{campaign.name}</strong><small>{typeLabels[campaign.type]}</small></span>
              <b className={campaign.active ? 'is-active' : ''}>
                {campaign.active
                  ? campaign.showInHero
                    ? 'Ativa · no topo'
                    : 'Ativa'
                  : 'Pausada'}
              </b>
            </button>
          ))}
        </aside>

        <div className="campaign-managerMain">
          <form className="campaign-managerForm" onSubmit={save}>
            <header>
              <div>
                <small>{selectedId ? 'Editar campanha' : 'Nova campanha'}</small>
                <h2>{form.name || 'Configure sua ação'}</h2>
              </div>
              <label className="campaign-managerToggle">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                />
                Campanha ativa
              </label>
            </header>
            <div className="campaign-managerFields">
              <label>Nome da campanha<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Tipo<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as Campaign['type'] })}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              {form.type === 'coupon' ? (
                <div className="campaign-couponRules is-wide">
                  <header>
                    <FiTag />
                    <span>
                      <strong>Regra de desconto no checkout</strong>
                      <small>O servidor confere valor mínimo, validade e limite antes de aceitar o cupom.</small>
                    </span>
                  </header>
                  <div>
                    <label>
                      Código público
                      <input
                        value={form.publicCouponCode}
                        onChange={(event) => setForm({ ...form, publicCouponCode: event.target.value.toUpperCase() })}
                        placeholder="Ex.: DESCONTO10"
                        maxLength={30}
                      />
                      <small>Deixe vazio se quiser usar somente códigos individuais distribuídos.</small>
                    </label>
                    <label>
                      Tipo de desconto
                      <select
                        value={form.discountType}
                        onChange={(event) => setForm({ ...form, discountType: event.target.value as Campaign['discountType'] })}
                      >
                        <option value="fixed">Valor fixo (R$)</option>
                        <option value="percentage">Percentual (%)</option>
                        <option value="free_delivery">Entrega grátis</option>
                      </select>
                    </label>
                    {form.discountType !== 'free_delivery' ? (
                      <label>
                        {form.discountType === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}
                        <input
                          type="number"
                          min="0.01"
                          max={form.discountType === 'percentage' ? 100 : undefined}
                          step="0.01"
                          value={form.discountValue}
                          onChange={(event) => setForm({ ...form, discountValue: Number(event.target.value) })}
                        />
                      </label>
                    ) : null}
                    <label>
                      Pedido mínimo (R$)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.minimumOrder}
                        onChange={(event) => setForm({ ...form, minimumOrder: Number(event.target.value) })}
                      />
                    </label>
                    {form.discountType === 'percentage' ? (
                      <label>
                        Desconto máximo (R$)
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.maxDiscount ?? ''}
                          onChange={(event) => setForm({ ...form, maxDiscount: event.target.value ? Number(event.target.value) : null })}
                          placeholder="Sem limite"
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <label className="is-wide">Chamada principal<input value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} placeholder="Ex.: Um presente especial para você" /></label>
              <label className="is-wide">Descrição<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
              <label className="is-wide">Benefício oferecido<textarea required value={form.benefit} onChange={(event) => setForm({ ...form, benefit: event.target.value })} placeholder="Ex.: Axila ou barba grátis e até 80% de desconto em outras áreas" /></label>
              <label>Parceiro<input value={form.partnerName} onChange={(event) => setForm({ ...form, partnerName: event.target.value })} /></label>
              <label>Prefixo do código<input maxLength={12} value={form.codePrefix} onChange={(event) => setForm({ ...form, codePrefix: event.target.value.toUpperCase() })} /></label>
              <label>Início<input type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} /></label>
              <label>Fim<input type="datetime-local" value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} /></label>
              <label>Limite por cliente<input type="number" min="1" max="20" value={form.perCustomerLimit} onChange={(event) => setForm({ ...form, perCustomerLimit: Number(event.target.value) })} /></label>
              <label>Imagem da campanha<input type="url" value={form.imageSrc} onChange={(event) => setForm({ ...form, imageSrc: event.target.value })} placeholder="https://..." /></label>
              <label className="is-wide campaign-heroVisibility">
                <input
                  type="checkbox"
                  checked={form.showInHero}
                  disabled={!form.showInHero && featuredCampaignCount >= 2}
                  onChange={(event) => setForm({ ...form, showInHero: event.target.checked })}
                />
                <span>
                  <strong>Exibir como destaque no cardápio</strong>
                  <small>
                    Mostra a imagem e a chamada desta campanha para o cliente.
                    {featuredCampaignCount >= 2 && !form.showInHero
                      ? ' O limite de duas campanhas já foi atingido.'
                      : ` ${featuredCampaignCount + (form.showInHero ? 1 : 0)}/2 destaques selecionados.`}
                  </small>
                </span>
              </label>
              <label className="is-wide campaign-autoDistribution">
                <input
                  type="checkbox"
                  checked={form.autoDistributeCompletedOrders}
                  onChange={(event) => setForm({ ...form, autoDistributeCompletedOrders: event.target.checked })}
                />
                <span>
                  <strong>Distribuir automaticamente após pedido finalizado</strong>
                  <small>Ideal para campanhas “comprou, ganhou”. A entrega do voucher acontece em segundo plano.</small>
                </span>
              </label>
              <label className="is-wide">Como utilizar<textarea value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} /></label>
              <label className="is-wide">Regras e observações<textarea value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></label>
            </div>
            <footer>
              {selectedId ? <button type="button" className="campaign-deleteButton" onClick={remove}><FiTrash2 /> Excluir</button> : <span />}
              <button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar campanha'}</button>
            </footer>
          </form>

          {selectedId ? (
            <section className="campaign-distribution">
              <header>
                <div><small>Distribuição</small><h2>Enviar vouchers</h2><p>Somente clientes com pedidos finalizados aparecem como elegíveis.</p></div>
                <FiSend />
              </header>
              <div className="campaign-customerPicker">
                <div>
                  <label><FiUsers /><input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Buscar cliente" /></label>
                  <button type="button" onClick={() => setSelectedCustomers(new Set(eligibleCustomers.map((customer) => customer.id)))}>Selecionar todos</button>
                </div>
                <div className="campaign-customerList">
                  {eligibleCustomers.map((customer) => (
                    <label key={customer.id}>
                      <input
                        type="checkbox"
                        checked={selectedCustomers.has(customer.id)}
                        onChange={(event) => {
                          const next = new Set(selectedCustomers)
                          if (event.target.checked) next.add(customer.id)
                          else next.delete(customer.id)
                          setSelectedCustomers(next)
                        }}
                      />
                      <span><strong>{customer.name}</strong><small>{customer.phone} · {customer.order_count} pedido(s) finalizado(s)</small></span>
                    </label>
                  ))}
                  {!eligibleCustomers.length ? <p>Nenhum cliente elegível encontrado.</p> : null}
                </div>
                <button type="button" disabled={saving || !selectedCustomers.size} onClick={() => distribute([...selectedCustomers])}>
                  <FiSend /> Distribuir para {selectedCustomers.size} cliente(s)
                </button>
              </div>

              <div className="campaign-voucherHistory">
                <header><strong>Vouchers distribuídos</strong><small>{campaignVouchers.length} no total</small></header>
                {campaignVouchers.map((voucher) => (
                  <article key={voucher.id}>
                    <span><code>{voucher.code}</code><small>{voucher.customerName} · {voucher.customerPhone}</small></span>
                    <b className={`is-${voucher.status}`}>{voucher.status === 'available' ? 'Disponível' : voucher.status === 'used' ? 'Utilizado' : 'Cancelado'}</b>
                    {voucher.status === 'available' ? (
                      <button type="button" onClick={() => setVoucherStatus(voucher.id, 'used')}><FiCheckCircle /> Marcar utilizado</button>
                    ) : null}
                  </article>
                ))}
                {!campaignVouchers.length ? <p>Nenhum voucher distribuído nesta campanha.</p> : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  )
}
