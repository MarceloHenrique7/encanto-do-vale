import { randomUUID } from 'node:crypto'

import { sanitizeText, toMoney } from '../api/_payment-utils.js'
import {
  createCategory,
  createExtra,
  createProduct,
  deleteCategory,
  deleteExtra,
  deleteProduct,
  getCatalog,
  updateCategory,
  updateExtra,
  updateProduct,
} from '../services/catalog-store.js'

function slug(value, fallback = '') {
  return (
    sanitizeText(value, 80)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') ||
    fallback ||
    randomUUID()
  )
}

function normalizeCategory(value) {
  const name = sanitizeText(value?.name, 80)
  if (!name) return { error: 'Informe o nome da categoria.' }
  return {
    category: {
      id: slug(value?.id || name),
      name,
      shortLabel: sanitizeText(value?.shortLabel, 120),
    },
  }
}

function normalizePricedEntries(entries, kind) {
  if (!Array.isArray(entries)) return []
  return entries.slice(0, 30).flatMap((entry) => {
    const label = sanitizeText(entry?.label, 100)
    const price = toMoney(entry?.price)
    if (!label || price <= 0 || price > 100_000) return []
    return [{
      id: slug(entry?.id || label),
      label,
      ...(kind === 'option' && sanitizeText(entry?.quantityLabel, 80)
        ? { quantityLabel: sanitizeText(entry.quantityLabel, 80) }
        : {}),
      price,
    }]
  })
}

function normalizeExtra(value) {
  const [extra] = normalizePricedEntries([value], 'extra')
  if (!extra) return { error: 'Informe um nome e um preço válido para o complemento.' }
  return { extra }
}

function normalizeExtraGroups(entries, extras) {
  if (!Array.isArray(entries) || !extras.length) return []
  const validExtraIds = new Set(extras.map((extra) => extra.id))
  const assignedExtraIds = new Set()
  const usedGroupIds = new Set()

  return entries.slice(0, 12).flatMap((entry) => {
    const label = sanitizeText(entry?.label, 100)
    const extraIds = Array.isArray(entry?.extraIds)
      ? [...new Set(entry.extraIds.map((id) => slug(id)))]
          .filter((id) => validExtraIds.has(id) && !assignedExtraIds.has(id))
          .slice(0, 30)
      : []
    if (!label || !extraIds.length) return []

    extraIds.forEach((id) => assignedExtraIds.add(id))
    const requestedMaximum = Number.parseInt(entry?.maxSelections, 10) || 1
    const minSelections = 0
    const maxSelections = Math.min(
      extraIds.length,
      Math.max(1, requestedMaximum),
    )

    const baseId = slug(entry?.id || label)
    let id = baseId
    let suffix = 2
    while (usedGroupIds.has(id)) {
      id = `${baseId}-${suffix}`
      suffix += 1
    }
    usedGroupIds.add(id)

    return [{
      id,
      label,
      minSelections,
      maxSelections,
      extraIds,
    }]
  })
}

async function normalizeProduct(value) {
  const catalog = await getCatalog()
  const name = sanitizeText(value?.name, 120)
  const description = sanitizeText(value?.description, 2_000)
  const basePrice = toMoney(value?.basePrice)
  const categoryIds = Array.isArray(value?.categoryIds)
    ? [...new Set(value.categoryIds.map((id) => slug(id)).filter(Boolean))]
    : []
  const validCategoryIds = categoryIds.filter((id) =>
    catalog.categories.some((category) => category.id === id),
  )

  if (!name || !description) {
    return { error: 'Informe nome e descrição do produto.' }
  }
  if (basePrice <= 0 || basePrice > 100_000) {
    return { error: 'Informe um preço base válido.' }
  }
  if (!validCategoryIds.length) {
    return { error: 'Selecione ao menos uma categoria válida.' }
  }

  const primaryCategory =
    catalog.categories.find((category) => category.id === validCategoryIds[0])
  const price =
    sanitizeText(value?.price, 100) ||
    `A partir de ${basePrice.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })}`
  const options = normalizePricedEntries(value?.options, 'option')
  const extras = normalizePricedEntries(value?.extras, 'extra')
  const extraGroups = normalizeExtraGroups(value?.extraGroups, extras)

  return {
    product: {
      id: slug(value?.id || name),
      name,
      description,
      price,
      basePrice,
      imageSrc: sanitizeText(value?.imageSrc, 1_000),
      fulfillmentType:
        value?.fulfillmentType === 'entrega-pronta'
          ? 'entrega-pronta'
          : 'encomenda',
      isAvailable: value?.isAvailable !== false,
      isFeatured: value?.isFeatured === true,
      isPromo: value?.isPromo === true,
      primaryCategoryLabel:
        sanitizeText(value?.primaryCategoryLabel, 80) ||
        primaryCategory?.name ||
        'Cardápio',
      categoryIds: validCategoryIds,
      ...(options.length ? { options } : {}),
      ...(extras.length ? { extras } : {}),
      ...(extraGroups.length ? { extraGroups } : {}),
    },
  }
}

export async function getPublicCatalog(_request, response) {
  response.setHeader('Cache-Control', 'no-store')
  return response.json(await getCatalog())
}

export async function getAdminCatalog(_request, response) {
  response.setHeader('Cache-Control', 'no-store')
  return response.json(await getCatalog())
}

export async function postAdminProduct(request, response) {
  const normalized = await normalizeProduct(request.body)
  if (normalized.error) return response.status(400).json({ error: normalized.error })
  const product = await createProduct(normalized.product)
  if (!product) return response.status(409).json({ error: 'Já existe um produto com este ID.' })
  return response.status(201).json({ product })
}

export async function putAdminProduct(request, response) {
  const normalized = await normalizeProduct(request.body)
  if (normalized.error) return response.status(400).json({ error: normalized.error })
  const result = await updateProduct(sanitizeText(request.params.id, 80), normalized.product)
  if (result === false) return response.status(409).json({ error: 'O novo ID já está em uso.' })
  if (!result) return response.status(404).json({ error: 'Produto não encontrado.' })
  return response.json({ product: result })
}

export async function removeAdminProduct(request, response) {
  const deleted = await deleteProduct(sanitizeText(request.params.id, 80))
  if (!deleted) return response.status(404).json({ error: 'Produto não encontrado.' })
  return response.status(204).end()
}

export async function postAdminExtra(request, response) {
  const normalized = normalizeExtra(request.body)
  if (normalized.error) return response.status(400).json({ error: normalized.error })
  const extra = await createExtra(normalized.extra)
  if (!extra) return response.status(409).json({ error: 'Já existe um complemento com este ID.' })
  return response.status(201).json({ extra })
}

export async function putAdminExtra(request, response) {
  const normalized = normalizeExtra(request.body)
  if (normalized.error) return response.status(400).json({ error: normalized.error })
  const result = await updateExtra(sanitizeText(request.params.id, 80), normalized.extra)
  if (result === false) return response.status(409).json({ error: 'O novo ID já está em uso.' })
  if (!result) return response.status(404).json({ error: 'Complemento não encontrado.' })
  return response.json({ extra: result })
}

export async function removeAdminExtra(request, response) {
  const deleted = await deleteExtra(sanitizeText(request.params.id, 80))
  if (!deleted) return response.status(404).json({ error: 'Complemento não encontrado.' })
  return response.status(204).end()
}

export async function postAdminCategory(request, response) {
  const normalized = normalizeCategory(request.body)
  if (normalized.error) return response.status(400).json({ error: normalized.error })
  const category = await createCategory(normalized.category)
  if (!category) return response.status(409).json({ error: 'Já existe uma categoria com este ID.' })
  return response.status(201).json({ category })
}

export async function putAdminCategory(request, response) {
  const normalized = normalizeCategory(request.body)
  if (normalized.error) return response.status(400).json({ error: normalized.error })
  const result = await updateCategory(sanitizeText(request.params.id, 80), normalized.category)
  if (result === false) return response.status(409).json({ error: 'O novo ID já está em uso.' })
  if (!result) return response.status(404).json({ error: 'Categoria não encontrada.' })
  return response.json({ category: result })
}

export async function removeAdminCategory(request, response) {
  const result = await deleteCategory(sanitizeText(request.params.id, 80))
  if (result === 'in-use') {
    return response.status(409).json({ error: 'Remova esta categoria dos produtos antes de excluí-la.' })
  }
  if (!result) return response.status(404).json({ error: 'Categoria não encontrada.' })
  return response.status(204).end()
}
