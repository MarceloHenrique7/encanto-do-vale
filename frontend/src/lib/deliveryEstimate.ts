export function calculateDeliveryEstimateMinutes(distanceKm?: number) {
  const distance = Number(distanceKm)
  if (!Number.isFinite(distance) || distance <= 0) return 30

  const chargedKilometers = Math.max(1, Math.ceil(distance))
  return 30 + (chargedKilometers - 1) * 5
}

export function formatDeliveryEstimate(minutes: number) {
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes ? `${hours}h ${remainingMinutes}min` : `${hours}h`
}

export function formatEstimatedArrival(createdAt: string, minutes: number) {
  const arrival = new Date(new Date(createdAt).getTime() + minutes * 60_000)
  if (Number.isNaN(arrival.getTime())) return ''

  return arrival.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
