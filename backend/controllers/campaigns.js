import { sanitizeText } from '../api/_payment-utils.js'
import {
  countFeaturedCampaigns,
  deleteCampaign,
  distributeCampaign,
  listAdminCampaigns,
  listCustomerCampaigns,
  listPublicCampaignHighlights,
  previewCampaignCoupon,
  saveCampaign,
  updateVoucherStatus,
} from '../services/campaign-store.js'

function slug(value) {
  return sanitizeText(value, 80)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function optionalDate(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : ''
}

function normalizeCampaign(body) {
  const name = sanitizeText(body?.name, 100)
  const type = ['voucher', 'coupon', 'gift', 'announcement'].includes(body?.type)
    ? body.type
    : 'voucher'
  const prefix =
    sanitizeText(body?.codePrefix, 12)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '') || 'VALE'
  const discountType = ['fixed', 'percentage', 'free_delivery'].includes(
    body?.discountType,
  )
    ? body.discountType
    : 'fixed'
  const discountValue = Math.max(0, Number(body?.discountValue) || 0)
  return {
    name,
    type,
    headline: sanitizeText(body?.headline, 140),
    description: sanitizeText(body?.description, 1_000),
    benefit: sanitizeText(body?.benefit, 300),
    partnerName: sanitizeText(body?.partnerName, 120),
    imageSrc: sanitizeText(body?.imageSrc, 1_000),
    instructions: sanitizeText(body?.instructions, 1_000),
    terms: sanitizeText(body?.terms, 1_000),
    active: body?.active !== false,
    startAt: optionalDate(body?.startAt),
    endAt: optionalDate(body?.endAt),
    codePrefix: prefix,
    perCustomerLimit: Math.min(
      20,
      Math.max(1, Number.parseInt(body?.perCustomerLimit, 10) || 1),
    ),
    autoDistributeCompletedOrders:
      body?.autoDistributeCompletedOrders === true,
    publicCouponCode: sanitizeText(body?.publicCouponCode, 30)
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, ''),
    discountType,
    discountValue:
      discountType === 'percentage'
        ? Math.min(100, discountValue)
        : discountValue,
    minimumOrder: Math.max(0, Number(body?.minimumOrder) || 0),
    maxDiscount:
      body?.maxDiscount === '' ||
      body?.maxDiscount === null ||
      body?.maxDiscount === undefined
        ? null
        : Math.max(0, Number(body.maxDiscount) || 0),
    showInHero: body?.showInHero === true,
  }
}

export async function getCustomerCampaigns(request, response) {
  const assignments = await listCustomerCampaigns(request.customerUser.id)
  return response.json({ assignments })
}

export async function getAdminCampaigns(_request, response) {
  return response.json(await listAdminCampaigns())
}

export async function putAdminCampaign(request, response) {
  const campaign = normalizeCampaign(request.body ?? {})
  const id = slug(request.params.id || request.body?.id || campaign.name)
  if (!campaign.name || !id) {
    return response.status(400).json({ error: 'Informe o nome da campanha.' })
  }
  if (
    campaign.startAt &&
    campaign.endAt &&
    new Date(campaign.endAt) < new Date(campaign.startAt)
  ) {
    return response.status(400).json({
      error: 'A data final deve ser posterior à data inicial.',
    })
  }
  if (
    campaign.active &&
    campaign.showInHero &&
    (await countFeaturedCampaigns(id)) >= 2
  ) {
    return response.status(409).json({
      error: 'Já existem duas campanhas em destaque no cardápio. Remova um destaque antes de ativar outro.',
    })
  }
  if (
    campaign.type === 'coupon' &&
    campaign.discountType !== 'free_delivery' &&
    campaign.discountValue <= 0
  ) {
    return response.status(400).json({
      error: 'Informe um desconto maior que zero para o cupom.',
    })
  }
  try {
    return response.json({ campaign: await saveCampaign(id, campaign) })
  } catch (error) {
    if (error?.code === '23505') {
      return response.status(409).json({
        error: 'Este código público já está sendo usado em outra campanha.',
      })
    }
    throw error
  }
}

export async function getPublicCampaignHighlights(_request, response) {
  const campaigns = await listPublicCampaignHighlights()
  return response.json({
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      type: campaign.type,
      name: campaign.name,
      headline: campaign.headline,
      description: campaign.description,
      benefit: campaign.benefit,
      partnerName: campaign.partnerName,
      imageSrc: campaign.imageSrc,
      publicCouponCode: campaign.publicCouponCode,
      endAt: campaign.endAt,
    })),
  })
}

export async function postAdminCampaign(request, response) {
  request.params.id = ''
  const result = await putAdminCampaign(request, response)
  if (!response.headersSent) response.status(201)
  return result
}

export async function removeAdminCampaign(request, response) {
  const removed = await deleteCampaign(sanitizeText(request.params.id, 80))
  if (!removed) {
    return response.status(409).json({
      error: 'Campanha não encontrada ou já possui vouchers distribuídos. Desative-a para manter o histórico.',
    })
  }
  return response.status(204).end()
}

export async function postAdminCampaignDistribution(request, response) {
  try {
    const customerIds = Array.isArray(request.body?.customerIds)
      ? request.body.customerIds
          .map((id) => sanitizeText(id, 80))
          .filter(Boolean)
          .slice(0, 1_000)
      : []
    if (!customerIds.length) {
      return response.status(400).json({
        error: 'Selecione pelo menos um cliente.',
      })
    }
    const vouchers = await distributeCampaign(
      sanitizeText(request.params.id, 80),
      customerIds,
    )
    return response.status(201).json({ vouchers, distributed: vouchers.length })
  } catch (error) {
    return response.status(409).json({ error: error.message })
  }
}

export async function patchAdminCampaignVoucher(request, response) {
  const status = sanitizeText(request.body?.status, 20)
  if (!['available', 'used', 'cancelled'].includes(status)) {
    return response.status(400).json({ error: 'Status do voucher inválido.' })
  }
  const voucher = await updateVoucherStatus(
    sanitizeText(request.params.id, 80),
    status,
  )
  if (!voucher) {
    return response.status(404).json({ error: 'Voucher não encontrado.' })
  }
  return response.json({ voucher })
}

export async function postCustomerCampaignValidation(request, response) {
  try {
    const coupon = await previewCampaignCoupon(
      request.customerUser.id,
      request.body?.code,
      request.body?.subtotal,
      request.body?.deliveryFee,
    )
    return response.json({ coupon })
  } catch (error) {
    return response.status(409).json({ error: error.message })
  }
}
