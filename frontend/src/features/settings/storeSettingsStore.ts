import { useEffect, useState } from 'react'

import { storeConfig } from '@/config/store'

export type WeeklyHour = (typeof storeConfig.weeklyHours)[number]
export type StoreSettings = { minimumOrder: number; minimumDeliveryFee: number; weeklyHours: WeeklyHour[] }

const defaults: StoreSettings = { minimumOrder: 0, minimumDeliveryFee: storeConfig.defaultDeliveryFee, weeklyHours: storeConfig.weeklyHours }
let snapshot = defaults
let request: Promise<StoreSettings> | null = null
const listeners = new Set<(settings: StoreSettings) => void>()

function loadSettings() {
  request ??= fetch('/api/store-settings')
    .then(async (response) => {
      if (!response.ok) throw new Error('Não foi possível carregar as configurações.')
      const data = await response.json()
      snapshot = {
        minimumOrder: Number(data.minimumOrder) || 0,
        minimumDeliveryFee: Number(data.minimumDeliveryFee) || 0,
        weeklyHours: Array.isArray(data.weeklyHours) ? data.weeklyHours : defaults.weeklyHours,
      }
      listeners.forEach((listener) => listener(snapshot))
      return snapshot
    })
    .catch(() => snapshot)
  return request
}

export function useStoreSettings() {
  const [settings, setSettings] = useState(snapshot)
  useEffect(() => {
    listeners.add(setSettings)
    void loadSettings()
    return () => {
      listeners.delete(setSettings)
    }
  }, [])
  return settings
}
