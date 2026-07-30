import { sanitizeText } from '../api/_payment-utils.js'
import {
  adjustPoints,
  deleteReward,
  getAdminLoyalty,
  getCustomerLoyalty,
  redeemReward,
  saveLoyaltySettings,
  saveReward,
} from '../services/loyalty-store.js'
import { getCatalog } from '../services/catalog-store.js'

function slug(value) {
  return sanitizeText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function rewardView(reward) {
  return {
    id: reward.id,
    name: reward.name,
    description: reward.description ?? '',
    imageSrc: reward.imageSrc ?? reward.image_src ?? '',
    pointsCost: Number(reward.pointsCost ?? reward.points_cost ?? 0),
    active: reward.active !== false,
    validFrom: reward.validFrom ?? reward.valid_from ?? '',
    validUntil: reward.validUntil ?? reward.valid_until ?? '',
    stock: reward.stock,
    perCustomerLimit: Number(reward.perCustomerLimit ?? reward.per_customer_limit ?? 1),
    minimumOrder: Number(reward.minimumOrder ?? reward.minimum_order ?? 0),
    productId: reward.productId ?? reward.product_id ?? '',
    instructions: reward.instructions ?? '',
  }
}

function loyaltyView(data) {
  return {
    settings: data.settings,
    account: data.account
      ? {
          currentBalance: Number(data.account.current_balance ?? 0),
          pendingBalance: Number(data.account.pending_balance ?? 0),
        }
      : null,
    transactions: data.transactions ?? [],
    rewards: (data.rewards ?? []).map(rewardView),
    redemptions: data.redemptions ?? [],
    accounts: data.accounts ?? [],
  }
}

export async function getCustomerPoints(request, response) {
  return response.json(loyaltyView(await getCustomerLoyalty(request.customerUser.id)))
}

export async function postCustomerRedemption(request, response) {
  try {
    const rewardId = sanitizeText(request.body?.rewardId, 80)
    if (!rewardId) return response.status(400).json({ error: 'Selecione uma recompensa.' })
    const result = await redeemReward(request.customerUser.id, rewardId)
    return response.status(201).json(result)
  } catch (error) {
    return response.status(409).json({ error: error.message })
  }
}

export async function getAdminPoints(_request, response) {
  return response.json(loyaltyView(await getAdminLoyalty()))
}

export async function putAdminPointsSettings(request, response) {
  const settings = await saveLoyaltySettings(request.body ?? {})
  return response.json({ settings })
}

export async function putAdminReward(request, response) {
  const name = sanitizeText(request.body?.name, 100)
  const id = slug(request.body?.id || name)
  if (!name || !id) return response.status(400).json({ error: 'Informe o nome da recompensa.' })
  const productId = sanitizeText(request.body?.productId, 80)
  if (productId) {
    const catalog = await getCatalog()
    if (!catalog.products.some((product) => product.id === productId)) {
      return response.status(400).json({ error: 'O produto da recompensa não existe no catálogo.' })
    }
  }
  const reward = await saveReward(sanitizeText(request.params.id, 80) || id, {
    ...request.body,
    id,
    name,
    description: sanitizeText(request.body?.description, 500),
    imageSrc: sanitizeText(request.body?.imageSrc, 1_000),
    productId,
    instructions: sanitizeText(request.body?.instructions, 500),
  })
  return response.json({ reward })
}

export async function postAdminReward(request, response) {
  request.params.id = ''
  return putAdminReward(request, response)
}

export async function removeAdminReward(request, response) {
  const removed = await deleteReward(sanitizeText(request.params.id, 80))
  if (!removed) return response.status(404).json({ error: 'Recompensa não encontrada.' })
  return response.status(204).end()
}

export async function postAdminPointsAdjustment(request, response) {
  try {
    const customerId = sanitizeText(request.body?.customerId, 80)
    const description = sanitizeText(request.body?.description, 300)
    await adjustPoints(customerId, request.body?.points, description)
    return response.status(201).json({ success: true })
  } catch (error) {
    return response.status(409).json({ error: error.message })
  }
}
