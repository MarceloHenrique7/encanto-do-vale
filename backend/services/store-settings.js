import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { deliveryZones as defaultDeliveryZones } from '../config/deliveryZones.js'
import { query, shouldUsePostgres } from './postgres.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.resolve(serviceDirectory, '../data/store-settings.json')
const defaultWeeklyHours = [
  { day: 0, label: 'Dom', open: '13:00', close: '19:30', closed: false },
  { day: 1, label: 'Seg', open: '18:45', close: '23:30', closed: false },
  { day: 2, label: 'Ter', open: '18:45', close: '23:30', closed: false },
  { day: 3, label: 'Qua', open: '18:45', close: '23:30', closed: false },
  { day: 4, label: 'Qui', open: '18:45', close: '23:30', closed: false },
  { day: 5, label: 'Sex', open: '18:45', close: '23:30', closed: false },
  { day: 6, label: 'Sab', open: '13:45', close: '19:00', closed: false },
]

function defaultFee(distanceKm) {
  if (distanceKm < 3.5) return 0
  return Number((6.99 + Math.floor(distanceKm - 3.5) * 1.5).toFixed(2))
}

export const defaultStoreSettings = Object.freeze({
  minimumOrder: 0,
  weeklyHours: defaultWeeklyHours,
  deliveryZones: defaultDeliveryZones.map((zone) => ({
    neighborhood: zone.neighborhood,
    distanceKm: zone.distanceKm,
    deliveryFee: defaultFee(zone.distanceKm),
    aliases: zone.aliases ?? [],
  })),
})

let settingsCache = structuredClone(defaultStoreSettings)
let loadPromise

function settingsFile() {
  return process.env.STORE_SETTINGS_FILE
    ? path.resolve(process.env.STORE_SETTINGS_FILE)
    : defaultFile
}

function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? ''))
}

function timeMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function normalizeSettings(input) {
  const minimumOrder = Number(input?.minimumOrder)
  const hours = Array.isArray(input?.weeklyHours) ? input.weeklyHours : []
  const zones = Array.isArray(input?.deliveryZones) ? input.deliveryZones : []
  if (!Number.isFinite(minimumOrder) || minimumOrder < 0 || minimumOrder > 100000) {
    throw new Error('Informe um pedido mínimo válido.')
  }
  if (hours.length !== 7) throw new Error('Configure os sete dias da semana.')

  const weeklyHours = hours
    .map((entry) => ({
      day: Number(entry.day),
      label: defaultWeeklyHours.find((day) => day.day === Number(entry.day))?.label ?? '',
      open: String(entry.open ?? ''),
      close: String(entry.close ?? ''),
      closed: Boolean(entry.closed),
    }))
    .sort((first, second) => first.day - second.day)
  if (
    weeklyHours.some(
      (entry, index) =>
        entry.day !== index ||
        (!entry.closed && (
          !validTime(entry.open) ||
          !validTime(entry.close) ||
          timeMinutes(entry.open) >= timeMinutes(entry.close)
        )),
    )
  ) {
    throw new Error('Revise os horários de funcionamento.')
  }

  const deliveryZones = zones.map((zone) => {
    const neighborhood = String(zone.neighborhood ?? '').trim().slice(0, 80)
    const deliveryFee = Number(zone.deliveryFee)
    const distanceKm = Number(zone.distanceKm ?? 0)
    if (!neighborhood || !Number.isFinite(deliveryFee) || deliveryFee < 0) {
      throw new Error('Revise os bairros e suas taxas de entrega.')
    }
    return {
      neighborhood,
      deliveryFee: Number(deliveryFee.toFixed(2)),
      distanceKm: Number.isFinite(distanceKm) && distanceKm >= 0 ? distanceKm : 0,
      aliases: Array.isArray(zone.aliases)
        ? zone.aliases.map((alias) => String(alias).trim()).filter(Boolean).slice(0, 10)
        : [],
    }
  })
  const uniqueNames = new Set(deliveryZones.map((zone) => zone.neighborhood.toLocaleLowerCase('pt-BR')))
  if (uniqueNames.size !== deliveryZones.length) throw new Error('Existem bairros repetidos.')

  return { minimumOrder: Number(minimumOrder.toFixed(2)), weeklyHours, deliveryZones }
}

async function readSettings() {
  if (shouldUsePostgres()) {
    const result = await query("select data from store_settings where key = 'main'")
    return result.rows[0]?.data ?? defaultStoreSettings
  }
  try {
    return JSON.parse(await readFile(settingsFile(), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return defaultStoreSettings
    throw error
  }
}

export async function getStoreSettings() {
  loadPromise ??= readSettings().then((settings) => {
    settingsCache = normalizeSettings(settings)
    return settingsCache
  })
  return loadPromise
}

export function getCachedStoreSettings() {
  return settingsCache
}

export async function saveStoreSettings(input) {
  const settings = normalizeSettings(input)
  if (shouldUsePostgres()) {
    await query(
      `insert into store_settings (key, data, updated_at) values ('main', $1, now())
       on conflict (key) do update set data = excluded.data, updated_at = now()`,
      [settings],
    )
  } else {
    const file = settingsFile()
    const temporaryFile = `${file}.${process.pid}.tmp`
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(temporaryFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    await rename(temporaryFile, file)
  }
  settingsCache = settings
  loadPromise = Promise.resolve(settings)
  return settings
}
