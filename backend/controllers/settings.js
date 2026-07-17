import { getStoreSettings, saveStoreSettings } from '../services/store-settings.js'

export async function getPublicStoreSettings(_request, response) {
  const settings = await getStoreSettings()
  return response.json({
    minimumOrder: settings.minimumOrder,
    minimumDeliveryFee: settings.deliveryZones.length
      ? Math.min(...settings.deliveryZones.map((zone) => zone.deliveryFee))
      : 0,
    weeklyHours: settings.weeklyHours,
  })
}

export async function getAdminStoreSettings(_request, response) {
  return response.json({ settings: await getStoreSettings() })
}

export async function putAdminStoreSettings(request, response) {
  try {
    return response.json({ settings: await saveStoreSettings(request.body) })
  } catch (error) {
    return response.status(400).json({ error: error.message })
  }
}
