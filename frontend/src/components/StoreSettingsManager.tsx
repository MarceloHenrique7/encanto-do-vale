import { FormEvent, useEffect, useState } from 'react'

import { formatCurrency } from '@/lib/formatters'

type WeeklyHour = { day: number; label: string; open: string; close: string; closed: boolean }
type DeliveryZone = { neighborhood: string; distanceKm: number; deliveryFee: number; aliases: string[] }
type Settings = { minimumOrder: number; weeklyHours: WeeklyHour[]; deliveryZones: DeliveryZone[] }

export default function StoreSettingsManager() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/store-settings')
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Não foi possível carregar.')
        setSettings(data.settings)
      })
      .catch((requestError) => setError(requestError.message))
  }, [])

  function updateHour(index: number, changes: Partial<WeeklyHour>) {
    setSettings((current) => current && ({
      ...current,
      weeklyHours: current.weeklyHours.map((hour, position) =>
        position === index ? { ...hour, ...changes } : hour,
      ),
    }))
  }

  function updateZone(index: number, changes: Partial<DeliveryZone>) {
    setSettings((current) => current && ({
      ...current,
      deliveryZones: current.deliveryZones.map((zone, position) =>
        position === index ? { ...zone, ...changes } : zone,
      ),
    }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!settings) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/admin/store-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível salvar.')
      setSettings(data.settings)
      setMessage('Configurações publicadas com sucesso.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) return <section className="store-settingsLoading">{error || 'Carregando configurações…'}</section>

  return (
    <form className="store-settingsManager" onSubmit={save}>
      <header className="store-settingsHero">
        <div><span>Operação da loja</span><h1>Configurações</h1><p>Horários, pedido mínimo e áreas de entrega em um só lugar.</p></div>
        <button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</button>
      </header>

      {message ? <p className="store-settingsSuccess">{message}</p> : null}
      {error ? <p className="manager-error">{error}</p> : null}

      <section className="store-settingsCard">
        <header><div><span>01</span><div><h2>Pedido mínimo</h2><p>Valor dos produtos, sem incluir a taxa de entrega.</p></div></div><strong>{formatCurrency(settings.minimumOrder)}</strong></header>
        <label className="store-settingsMinimum"><span>Valor mínimo (R$)</span><input type="number" min="0" step="0.01" value={settings.minimumOrder} onChange={(event) => setSettings({ ...settings, minimumOrder: Number(event.target.value) })} /></label>
      </section>

      <section className="store-settingsCard">
        <header><div><span>02</span><div><h2>Horários de funcionamento</h2><p>Marque o dia como fechado ou informe abertura e encerramento.</p></div></div></header>
        <div className="store-hoursEditor">
          {settings.weeklyHours.map((hour, index) => (
            <div className={hour.closed ? 'is-closed' : ''} key={hour.day}>
              <strong>{hour.label}</strong>
              <label><input type="checkbox" checked={hour.closed} onChange={(event) => updateHour(index, { closed: event.target.checked })} /> Fechado</label>
              <input aria-label={`Abertura ${hour.label}`} type="time" disabled={hour.closed} value={hour.open} onChange={(event) => updateHour(index, { open: event.target.value })} />
              <span>até</span>
              <input aria-label={`Fechamento ${hour.label}`} type="time" disabled={hour.closed} value={hour.close} onChange={(event) => updateHour(index, { close: event.target.value })} />
            </div>
          ))}
        </div>
      </section>

      <section className="store-settingsCard">
        <header><div><span>03</span><div><h2>Bairros e taxas</h2><p>Adicione, edite ou remova as regiões atendidas.</p></div></div><button type="button" onClick={() => setSettings({ ...settings, deliveryZones: [...settings.deliveryZones, { neighborhood: '', distanceKm: 0, deliveryFee: 0, aliases: [] }] })}>Adicionar bairro</button></header>
        <div className="store-zonesEditor">
          <div className="store-zonesLabels"><span>Bairro</span><span>Distância (km)</span><span>Taxa (R$)</span><span /></div>
          {settings.deliveryZones.map((zone, index) => (
            <div key={`${zone.neighborhood}-${index}`}>
              <input aria-label="Nome do bairro" placeholder="Nome do bairro" value={zone.neighborhood} onChange={(event) => updateZone(index, { neighborhood: event.target.value })} />
              <input aria-label="Distância em quilômetros" type="number" min="0" step="0.1" value={zone.distanceKm} onChange={(event) => updateZone(index, { distanceKm: Number(event.target.value) })} />
              <input aria-label="Taxa de entrega" type="number" min="0" step="0.01" value={zone.deliveryFee} onChange={(event) => updateZone(index, { deliveryFee: Number(event.target.value) })} />
              <button type="button" onClick={() => setSettings({ ...settings, deliveryZones: settings.deliveryZones.filter((_, position) => position !== index) })}>Remover</button>
            </div>
          ))}
        </div>
      </section>

      <footer className="store-settingsFooter"><span>{settings.deliveryZones.length} bairros configurados</span><button type="submit" disabled={saving}>{saving ? 'Salvando…' : 'Salvar e publicar'}</button></footer>
    </form>
  )
}
