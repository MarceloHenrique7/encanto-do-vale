import {
  formatCurrencyBRL,
  listDeliveryZones,
  validateDeliveryZone,
} from '../utils/deliveryFee.js'

export function getDeliveryZones(_request, response) {
  return response.json({
    calculationMode: 'fixed-zones',
    zones: listDeliveryZones(),
  })
}

export function postCalculateDelivery(request, response) {
  const deliveryType =
    request.body?.deliveryType ?? request.body?.delivery_type ?? 'delivery'

  if (deliveryType === 'pickup') {
    return response.json({
      available: true,
      deliveryType: 'pickup',
      distanceKm: 0,
      deliveryFee: 0,
      formattedDeliveryFee: formatCurrencyBRL(0),
    })
  }

  const result = validateDeliveryZone(request.body?.neighborhood)
  if (!result.available) {
    return response.json(result)
  }

  return response.json({
    ...result,
    deliveryType: 'delivery',
    formattedDeliveryFee: formatCurrencyBRL(result.deliveryFee),
  })
}
