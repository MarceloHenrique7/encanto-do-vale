import { sanitizeText } from '../api/_payment-utils.js'
import {
  deleteCustomerAddress,
  listCustomerAddresses,
  upsertCustomerAddress,
} from '../services/address-store.js'
import { getStoreSettings } from '../services/store-settings.js'
import { validateDeliveryZone } from '../utils/deliveryFee.js'

export function normalizeCustomerAddress(body, fallbackUser = {}) {
  return {
    label: sanitizeText(body?.label, 30) || 'Casa',
    recipientName:
      sanitizeText(body?.recipientName ?? body?.name, 80) ||
      sanitizeText(fallbackUser.name, 80),
    phone: String(body?.phone ?? fallbackUser.phone ?? '')
      .replace(/\D/g, '')
      .slice(0, 20),
    address: sanitizeText(body?.address, 160),
    number: sanitizeText(body?.number, 20),
    neighborhood: sanitizeText(body?.neighborhood, 80),
    complement: sanitizeText(body?.complement, 120),
  }
}

function addressError(address) {
  if (!address.recipientName) return 'Informe o nome de quem vai receber.'
  if (address.phone.length < 10) return 'Informe um WhatsApp válido.'
  if (!address.address || !address.number || !address.neighborhood) {
    return 'Informe endereço, número e bairro.'
  }
  return ''
}

export async function getCustomerAddresses(request, response) {
  return response.json({
    addresses: await listCustomerAddresses(request.customerUser.id),
  })
}

export async function postCustomerAddress(request, response) {
  const address = normalizeCustomerAddress(request.body, request.customerUser)
  const error = addressError(address)
  if (error) return response.status(400).json({ error })
  await getStoreSettings()
  const deliveryZone = validateDeliveryZone(address.neighborhood)
  if (!deliveryZone.available) {
    return response.status(400).json({ error: deliveryZone.message })
  }
  address.neighborhood = deliveryZone.neighborhood
  const saved = await upsertCustomerAddress(request.customerUser.id, address)
  if (!saved) {
    return response.status(409).json({
      error: 'Você pode manter no máximo 10 endereços salvos.',
    })
  }
  return response.status(201).json({ address: saved })
}

export async function removeCustomerAddress(request, response) {
  const removed = await deleteCustomerAddress(
    request.customerUser.id,
    sanitizeText(request.params.id, 80),
  )
  if (!removed) return response.status(404).json({ error: 'Endereço não encontrado.' })
  return response.status(204).end()
}
