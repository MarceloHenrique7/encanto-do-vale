export function calculateDeliveryEstimateMinutes(distanceKm) {
  const distance = Number(distanceKm)
  if (!Number.isFinite(distance) || distance <= 0) return 30

  const chargedKilometers = Math.max(1, Math.ceil(distance))
  return 30 + (chargedKilometers - 1) * 5
}
