import { deliveryZones } from '../config/deliveryZones.js'

export const UNAVAILABLE_DELIVERY_MESSAGE =
  'Esse bairro ainda não está disponível para entrega. Chame no WhatsApp para consultar.'

export function calculateDeliveryFee(distanceKm) {
  const distance = Number(distanceKm)

  if (!Number.isFinite(distance) || distance < 0) {
    throw new TypeError('A distância deve ser um número positivo.')
  }
  if (distance <= 3 || distance < 3.5) {
    return 0
  }

  return Number((6.99 + Math.floor(distance - 3.5) * 1.5).toFixed(2))
}

export function normalizeNeighborhoodName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-_/]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const deliveryZoneIndex = new Map()

for (const zone of deliveryZones) {
  const names = [zone.neighborhood, ...(zone.aliases ?? [])]
  for (const name of names) {
    deliveryZoneIndex.set(normalizeNeighborhoodName(name), zone)
  }
}

export function getDeliveryZoneByNeighborhood(neighborhood) {
  const zone = deliveryZoneIndex.get(normalizeNeighborhoodName(neighborhood))
  if (!zone) return null

  return {
    neighborhood: zone.neighborhood,
    distanceKm: zone.distanceKm,
    deliveryFee: calculateDeliveryFee(zone.distanceKm),
  }
}

export function validateDeliveryZone(neighborhood) {
  const zone = getDeliveryZoneByNeighborhood(neighborhood)

  return zone
    ? { available: true, ...zone }
    : { available: false, message: UNAVAILABLE_DELIVERY_MESSAGE }
}

export function formatCurrencyBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0)
}

export function listDeliveryZones() {
  return deliveryZones
    .map((zone) => {
      const deliveryFee = calculateDeliveryFee(zone.distanceKm)
      return {
        neighborhood: zone.neighborhood,
        distanceKm: zone.distanceKm,
        deliveryFee,
        formattedDeliveryFee:
          deliveryFee === 0 ? 'Grátis' : formatCurrencyBRL(deliveryFee),
      }
    })
    .sort((first, second) =>
      first.neighborhood.localeCompare(second.neighborhood, 'pt-BR'),
    )
}
