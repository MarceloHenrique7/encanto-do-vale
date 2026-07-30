import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  FiBox,
  FiCopy,
  FiEdit3,
  FiCheck,
  FiEye,
  FiEyeOff,
  FiGrid,
  FiHash,
  FiImage,
  FiLayers,
  FiLink,
  FiPackage,
  FiPlus,
  FiSearch,
  FiTag,
  FiTrash2,
  FiZap,
} from 'react-icons/fi'

import type {
  Category,
  Product,
  ProductExtra,
  ProductExtraGroup,
  ProductOption,
  PromotionCard,
} from '@/domain/catalog'
import { refreshCatalog } from '@/features/catalog/catalogStore'
import { formatCurrency } from '@/lib/formatters'

type Catalog = {
  products: Product[]
  categories: Category[]
  extras: ProductExtra[]
  promotions: PromotionCard[]
}
type ExtraDraft = Omit<ProductExtra, 'price'> & { price: string }
type PromotionDraft = PromotionCard
type CatalogArea = 'products' | 'promotions' | 'extras' | 'categories'
type DraftProduct = Omit<Product, 'basePrice' | 'options' | 'extras' | 'extraGroups'> & {
  basePrice: string
  options: Array<Omit<ProductOption, 'price'> & { price: string }>
  extras: Array<Omit<ProductExtra, 'price'> & { price: string }>
  extraGroups: Array<
    Omit<ProductExtraGroup, 'minSelections' | 'maxSelections'> & {
      minSelections: string
      maxSelections: string
    }
  >
}

const emptyCatalog: Catalog = {
  products: [],
  categories: [],
  extras: [],
  promotions: [],
}

const emptyPromotion: PromotionDraft = {
  id: '',
  eyebrow: 'Oferta especial',
  title: '',
  subtitle: '',
  ctaLabel: 'Ver oferta',
  imageSrc: '',
  productId: '',
  tone: 'dark',
  isActive: true,
}

function slug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function money(value: string) {
  const normalized = value.trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  return Number(normalized) || 0
}

function newDraft(categories: Category[]): DraftProduct {
  return {
    id: '',
    name: '',
    description: '',
    price: '',
    basePrice: '',
    imageSrc: '',
    fulfillmentType: 'encomenda',
    isAvailable: true,
    isFeatured: false,
    isPromo: false,
    primaryCategoryLabel: categories[0]?.name ?? '',
    categoryIds: categories[0] ? [categories[0].id] : [],
    options: [],
    extras: [],
    extraGroups: [],
  }
}

function productDraft(product: Product): DraftProduct {
  return {
    ...product,
    basePrice: String(product.basePrice).replace('.', ','),
    options: (product.options ?? []).map((option) => ({
      ...option,
      price: String(option.price).replace('.', ','),
    })),
    extras: (product.extras ?? []).map((extra) => ({
      ...extra,
      price: String(extra.price).replace('.', ','),
    })),
    extraGroups: (product.extraGroups ?? []).map((group) => ({
      ...group,
      minSelections: String(group.minSelections),
      maxSelections: String(group.maxSelections),
    })),
  }
}

function productPayload(draft: DraftProduct) {
  return {
    ...draft,
    id: draft.id || slug(draft.name),
    basePrice: money(draft.basePrice),
    options: draft.options.map((option) => ({ ...option, price: money(option.price) })),
    extras: draft.extras.map((extra) => ({ ...extra, price: money(extra.price) })),
    extraGroups: draft.extraGroups.map((group) => ({
      ...group,
      minSelections: 0,
      maxSelections: Math.max(1, Number.parseInt(group.maxSelections, 10) || 1),
    })),
  }
}

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Não foi possível concluir a operação.')
  return data
}

export default function CatalogManager() {
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog)
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState<DraftProduct>(() => newDraft([]))
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [categoryDraft, setCategoryDraft] = useState<Category>({
    id: '',
    name: '',
    shortLabel: '',
  })
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [extraDraft, setExtraDraft] = useState<ExtraDraft>({ id: '', label: '', price: '' })
  const [editingExtraId, setEditingExtraId] = useState('')
  const [extraSearch, setExtraSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [promotionDraft, setPromotionDraft] = useState<PromotionDraft>(emptyPromotion)
  const [editingPromotionId, setEditingPromotionId] = useState('')
  const [activeCatalogArea, setActiveCatalogArea] = useState<CatalogArea>('products')

  async function loadCatalog(selectFirst = false) {
    setLoading(true)
    try {
      const next = await api('/api/admin/catalog')
      setCatalog(next)
      if (selectFirst && next.products[0]) {
        setSelectedId(next.products[0].id)
        setDraft(productDraft(next.products[0]))
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar catálogo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCatalog(true)
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return catalog.products
    return catalog.products.filter((product) =>
      `${product.name} ${product.description} ${product.primaryCategoryLabel}`
        .toLocaleLowerCase('pt-BR')
        .includes(term),
    )
  }, [catalog.products, search])

  const reusableExtras = useMemo(() => {
    return catalog.extras.map((extra) => ({
      ...extra,
      sourceProducts: catalog.products
        .filter((product) => product.extras?.some((item) => item.id === extra.id))
        .map((product) => product.name),
    })).sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'))
  }, [catalog.extras, catalog.products])

  const filteredExtras = useMemo(() => {
    const term = extraSearch.trim().toLocaleLowerCase('pt-BR')
    if (!term) return reusableExtras
    return reusableExtras.filter((extra) =>
      `${extra.label} ${extra.id}`.toLocaleLowerCase('pt-BR').includes(term),
    )
  }, [extraSearch, reusableExtras])

  const categoryInsights = useMemo(() => {
    return catalog.categories.map((category) => {
      const products = catalog.products.filter((product) =>
        product.categoryIds.includes(category.id),
      )
      return {
        ...category,
        productCount: products.length,
        visibleCount: products.filter((product) => product.isAvailable).length,
      }
    })
  }, [catalog.categories, catalog.products])

  const filteredCategories = useMemo(() => {
    const term = categorySearch.trim().toLocaleLowerCase('pt-BR')
    if (!term) return categoryInsights
    return categoryInsights.filter((category) =>
      `${category.name} ${category.shortLabel} ${category.id}`
        .toLocaleLowerCase('pt-BR')
        .includes(term),
    )
  }, [categoryInsights, categorySearch])

  function choose(product: Product) {
    setSelectedId(product.id)
    setDraft(productDraft(product))
    setMessage('')
  }

  function createProduct() {
    setActiveCatalogArea('products')
    setSelectedId('')
    setDraft(newDraft(catalog.categories))
    setMessage('Preencha os dados do novo produto.')
  }

  function duplicate() {
    setSelectedId('')
    setDraft((current) => ({
      ...current,
      id: `${current.id || slug(current.name)}-copia`,
      name: `${current.name} - cópia`,
    }))
    setMessage('Cópia criada. Revise e salve o novo item.')
  }

  function patchDraft<K extends keyof DraftProduct>(key: K, value: DraftProduct[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function patchOption(
    index: number,
    changes: Partial<DraftProduct['options'][number]>,
  ) {
    patchDraft(
      'options',
      draft.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...changes } : option,
      ),
    )
  }

  function patchExtra(
    index: number,
    changes: Partial<DraftProduct['extras'][number]>,
  ) {
    patchDraft(
      'extras',
      draft.extras.map((extra, extraIndex) =>
        extraIndex === index ? { ...extra, ...changes } : extra,
      ),
    )
  }

  function patchExtraGroup(
    index: number,
    changes: Partial<DraftProduct['extraGroups'][number]>,
  ) {
    patchDraft(
      'extraGroups',
      draft.extraGroups.map((group, groupIndex) =>
        groupIndex === index ? { ...group, ...changes } : group,
      ),
    )
  }

  function toggleGroupExtra(groupIndex: number, extraId: string) {
    setDraft((current) => {
      const selectedGroup = current.extraGroups[groupIndex]
      if (!selectedGroup) return current
      const isRemoving = selectedGroup.extraIds.includes(extraId)
      const extraGroups = current.extraGroups.map((group, index) => {
        if (index === groupIndex) {
          return {
            ...group,
            extraIds: isRemoving
              ? group.extraIds.filter((id) => id !== extraId)
              : [...group.extraIds, extraId],
          }
        }
        return isRemoving
          ? group
          : { ...group, extraIds: group.extraIds.filter((id) => id !== extraId) }
      })
      return { ...current, extraGroups }
    })
  }

  function removeExtra(index: number) {
    const extraId = draft.extras[index]?.id
    setDraft((current) => ({
      ...current,
      extras: current.extras.filter((_, extraIndex) => extraIndex !== index),
      extraGroups: extraId
        ? current.extraGroups.map((group) => ({
            ...group,
            extraIds: group.extraIds.filter((id) => id !== extraId),
          }))
        : current.extraGroups,
    }))
  }

  function renameExtra(index: number, label: string) {
    setDraft((current) => {
      const savedExtra = current.extras[index]
      if (!savedExtra) return current
      const shouldRegenerateId =
        !savedExtra.id || savedExtra.id === slug(savedExtra.label)
      const nextId = shouldRegenerateId ? slug(label) : savedExtra.id
      return {
        ...current,
        extras: current.extras.map((extra, extraIndex) =>
          extraIndex === index ? { ...extra, label, id: nextId } : extra,
        ),
        extraGroups: current.extraGroups.map((group) => ({
          ...group,
          extraIds: group.extraIds.map((id) =>
            id === savedExtra.id ? nextId : id,
          ),
        })),
      }
    })
  }

  function hasExtra(extra: ProductExtra) {
    return draft.extras.some(
      (current) =>
        slug(current.label) === slug(extra.label) &&
        money(current.price) === extra.price,
    )
  }

  function reuseExtra(extra: ProductExtra) {
    if (hasExtra(extra)) return
    const usedIds = new Set(draft.extras.map((current) => current.id))
    const baseId = extra.id || slug(extra.label)
    let nextId = baseId
    let suffix = 2
    while (usedIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`
      suffix += 1
    }
    patchDraft('extras', [
      ...draft.extras,
      { id: nextId, label: extra.label, price: String(extra.price).replace('.', ',') },
    ])
  }

  function reuseAllExtras() {
    setDraft((current) => {
      const extras = [...current.extras]
      const usedIds = new Set(extras.map((saved) => saved.id))

      reusableExtras.forEach((extra) => {
        const alreadyAdded = extras.some(
          (saved) =>
            slug(saved.label) === slug(extra.label) &&
            money(saved.price) === extra.price,
        )
        if (alreadyAdded) return

        const baseId = extra.id || slug(extra.label)
        let nextId = baseId
        let suffix = 2
        while (usedIds.has(nextId)) {
          nextId = `${baseId}-${suffix}`
          suffix += 1
        }
        usedIds.add(nextId)
        extras.push({
          id: nextId,
          label: extra.label,
          price: String(extra.price).replace('.', ','),
        })
      })

      return { ...current, extras }
    })
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault()
    const invalidGroup = draft.extraGroups.find((group) => {
      const maximum = Number.parseInt(group.maxSelections, 10) || 0
      return (
        !group.label.trim() ||
        !group.extraIds.length ||
        maximum < 1 ||
        maximum > group.extraIds.length
      )
    })
    if (invalidGroup) {
      setMessage(
        `Revise o grupo “${invalidGroup.label || 'sem nome'}”: selecione complementos e confira o limite máximo.`,
      )
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const path = selectedId
        ? `/api/admin/products/${encodeURIComponent(selectedId)}`
        : '/api/admin/products'
      const data = await api(path, {
        method: selectedId ? 'PUT' : 'POST',
        body: JSON.stringify(productPayload(draft)),
      })
      setSelectedId(data.product.id)
      setDraft(productDraft(data.product))
      await loadCatalog()
      await refreshCatalog()
      setMessage('Produto salvo e publicado no cardápio.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar produto.')
    } finally {
      setSaving(false)
    }
  }

  async function removeProduct() {
    if (!selectedId || !window.confirm(`Excluir “${draft.name}” definitivamente?`)) return
    try {
      await api(`/api/admin/products/${encodeURIComponent(selectedId)}`, {
        method: 'DELETE',
      })
      setSelectedId('')
      setDraft(newDraft(catalog.categories))
      await loadCatalog()
      await refreshCatalog()
      setMessage('Produto excluído.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao excluir produto.')
    }
  }

  async function toggleAvailability(product: Product) {
    try {
      await api(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ ...product, isAvailable: !product.isAvailable }),
      })
      await loadCatalog()
      await refreshCatalog()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao alterar disponibilidade.')
    }
  }

  function toggleCategory(category: Category) {
    const selected = draft.categoryIds.includes(category.id)
    const categoryIds = selected
      ? draft.categoryIds.filter((id) => id !== category.id)
      : [...draft.categoryIds, category.id]
    patchDraft('categoryIds', categoryIds)
    if (!selected && categoryIds.length === 1) {
      patchDraft('primaryCategoryLabel', category.name)
    }
  }

  async function saveCategory() {
    try {
      const data = await api(
        editingCategoryId
          ? `/api/admin/categories/${encodeURIComponent(editingCategoryId)}`
          : '/api/admin/categories',
        {
          method: editingCategoryId ? 'PUT' : 'POST',
          body: JSON.stringify(categoryDraft),
        },
      )
      setEditingCategoryId(data.category.id)
      setCategoryDraft(data.category)
      await loadCatalog()
      await refreshCatalog()
      setMessage('Categoria salva.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar categoria.')
    }
  }

  async function removeCategory() {
    if (!editingCategoryId || !window.confirm('Excluir esta categoria?')) return
    try {
      await api(`/api/admin/categories/${encodeURIComponent(editingCategoryId)}`, {
        method: 'DELETE',
      })
      setEditingCategoryId('')
      setCategoryDraft({ id: '', name: '', shortLabel: '' })
      await loadCatalog()
      await refreshCatalog()
      setMessage('Categoria excluída.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao excluir categoria.')
    }
  }

  function createExtraDraft() {
    setActiveCatalogArea('extras')
    setEditingExtraId('')
    setExtraDraft({ id: '', label: '', price: '' })
  }

  function createCategoryDraft() {
    setActiveCatalogArea('categories')
    setEditingCategoryId('')
    setCategoryDraft({ id: '', name: '', shortLabel: '' })
  }

  function chooseExtra(extra: ProductExtra) {
    setEditingExtraId(extra.id)
    setExtraDraft({ ...extra, price: String(extra.price).replace('.', ',') })
  }

  async function saveExtra(event: FormEvent) {
    event.preventDefault()
    try {
      const payload = {
        id: extraDraft.id || slug(extraDraft.label),
        label: extraDraft.label,
        price: money(extraDraft.price),
      }
      const data = await api(
        editingExtraId
          ? `/api/admin/extras/${encodeURIComponent(editingExtraId)}`
          : '/api/admin/extras',
        {
          method: editingExtraId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      )
      setEditingExtraId(data.extra.id)
      setExtraDraft({ ...data.extra, price: String(data.extra.price).replace('.', ',') })
      await loadCatalog()
      await refreshCatalog()
      setMessage('Complemento salvo no banco de dados e publicado no cardápio.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar complemento.')
    }
  }

  async function removeLibraryExtra() {
    if (!editingExtraId) return
    const usageCount = catalog.products.filter((product) =>
      product.extras?.some((extra) => extra.id === editingExtraId),
    ).length
    const warning = usageCount
      ? `Este complemento está em ${usageCount} produto(s). Ao excluir, ele também será removido desses produtos. Continuar?`
      : 'Excluir este complemento definitivamente?'
    if (!window.confirm(warning)) return
    try {
      await api(`/api/admin/extras/${encodeURIComponent(editingExtraId)}`, {
        method: 'DELETE',
      })
      setEditingExtraId('')
      setExtraDraft({ id: '', label: '', price: '' })
      await loadCatalog()
      await refreshCatalog()
      setMessage('Complemento excluído do banco de dados e dos produtos vinculados.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao excluir complemento.')
    }
  }

  function createPromotionDraft() {
    setActiveCatalogArea('promotions')
    const firstProduct = catalog.products.find((product) => product.isAvailable)
    setEditingPromotionId('')
    setPromotionDraft({
      ...emptyPromotion,
      productId: firstProduct?.id ?? '',
      imageSrc: firstProduct?.imageSrc ?? '',
    })
  }

  function choosePromotion(promotion: PromotionCard) {
    setEditingPromotionId(promotion.id)
    setPromotionDraft(promotion)
  }

  async function savePromotion(event: FormEvent) {
    event.preventDefault()
    try {
      const payload = {
        ...promotionDraft,
        id: promotionDraft.id || slug(promotionDraft.title),
      }
      const data = await api(
        editingPromotionId
          ? `/api/admin/promotions/${encodeURIComponent(editingPromotionId)}`
          : '/api/admin/promotions',
        {
          method: editingPromotionId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
      )
      setEditingPromotionId(data.promotion.id)
      setPromotionDraft(data.promotion)
      await loadCatalog()
      await refreshCatalog()
      setMessage('Card promocional salvo e publicado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar promoção.')
    }
  }

  async function removePromotion() {
    if (
      !editingPromotionId ||
      !window.confirm('Excluir este card promocional definitivamente?')
    ) return
    try {
      await api(`/api/admin/promotions/${encodeURIComponent(editingPromotionId)}`, {
        method: 'DELETE',
      })
      setEditingPromotionId('')
      setPromotionDraft(emptyPromotion)
      await loadCatalog()
      await refreshCatalog()
      setMessage('Card promocional excluído.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao excluir promoção.')
    }
  }

  const productFormCompletion = [
    Boolean(draft.name.trim()),
    money(draft.basePrice) > 0,
    Boolean(draft.description.trim()),
    Boolean(draft.imageSrc.trim()),
    draft.categoryIds.length > 0,
  ].filter(Boolean).length
  const areaCopy: Record<CatalogArea, { eyebrow: string; title: string; description: string }> = {
    products: {
      eyebrow: 'Produtos',
      title: 'Gerencie os itens do cardápio',
      description: 'Crie, edite e publique cada produto em um espaço dedicado.',
    },
    promotions: {
      eyebrow: 'Campanhas',
      title: 'Cards promocionais',
      description: 'Destaques visuais que levam o cliente diretamente para uma oferta.',
    },
    extras: {
      eyebrow: 'Personalização',
      title: 'Complementos',
      description: 'Gerencie adicionais e preços sem misturar com o cadastro de produtos.',
    },
    categories: {
      eyebrow: 'Organização',
      title: 'Categorias',
      description: 'Organize as seções que aparecem na vitrine do cliente.',
    },
  }

  return (
    <section className="catalog-manager">
      <div className="catalog-managerHero">
        <div>
          <span>{areaCopy[activeCatalogArea].eyebrow}</span>
          <h1>{areaCopy[activeCatalogArea].title}</h1>
          <p>{areaCopy[activeCatalogArea].description}</p>
        </div>
        <div className="catalog-managerHeroActions">
          {activeCatalogArea === 'products' ? <button type="button" className="manager-primaryAction" onClick={createProduct}><FiPlus /> Novo produto</button> : null}
          {activeCatalogArea === 'promotions' ? <button type="button" className="manager-primaryAction" onClick={createPromotionDraft}><FiPlus /> Nova promoção</button> : null}
          {activeCatalogArea === 'extras' ? <button type="button" className="manager-primaryAction" onClick={createExtraDraft}><FiPlus /> Novo complemento</button> : null}
          {activeCatalogArea === 'categories' ? <button type="button" className="manager-primaryAction" onClick={createCategoryDraft}><FiPlus /> Nova categoria</button> : null}
        </div>
      </div>

      <nav className="catalog-managerNav" aria-label="Áreas do catálogo">
        <button type="button" className={activeCatalogArea === 'products' ? 'is-active' : ''} onClick={() => setActiveCatalogArea('products')}><FiBox /><span><strong>Produtos</strong><small>{catalog.products.length} itens</small></span></button>
        <button type="button" className={activeCatalogArea === 'promotions' ? 'is-active' : ''} onClick={() => setActiveCatalogArea('promotions')}><FiZap /><span><strong>Promoções</strong><small>{catalog.promotions.length} cards</small></span></button>
        <button type="button" className={activeCatalogArea === 'extras' ? 'is-active' : ''} onClick={() => setActiveCatalogArea('extras')}><FiLayers /><span><strong>Complementos</strong><small>{catalog.extras.length} adicionais</small></span></button>
        <button type="button" className={activeCatalogArea === 'categories' ? 'is-active' : ''} onClick={() => setActiveCatalogArea('categories')}><FiGrid /><span><strong>Categorias</strong><small>{catalog.categories.length} seções</small></span></button>
      </nav>

      {message ? <p className="catalog-managerMessage">{message}</p> : null}

      {activeCatalogArea === 'promotions' ? <section className="catalog-promotionManager" id="promocoes">
        <header className="catalog-studioHeader">
          <div className="catalog-studioTitle">
            <span className="catalog-studioIcon catalog-studioIcon--promotion"><FiZap /></span>
            <div><small>Campanhas da loja</small><h2>Cards promocionais</h2><p>Destaques compactos que levam o cliente direto ao produto.</p></div>
          </div>
          <div className="catalog-studioHeaderActions">
            <span><strong>{catalog.promotions.length}</strong> cards</span>
            <span><strong>{catalog.promotions.filter((item) => item.isActive).length}</strong> ativos</span>
          </div>
        </header>
        <div className="catalog-promotionBody">
          <div className="catalog-promotionList">
            {catalog.promotions.map((promotion) => (
              <button
                type="button"
                className={editingPromotionId === promotion.id ? 'is-active' : ''}
                key={promotion.id}
                onClick={() => choosePromotion(promotion)}
              >
                <span className={`catalog-promotionThumb is-${promotion.tone}`}>
                  {promotion.imageSrc ? <img src={promotion.imageSrc} alt="" /> : <FiZap />}
                </span>
                <span><strong>{promotion.title}</strong><small>{promotion.eyebrow} · {promotion.isActive ? 'Ativo' : 'Pausado'}</small></span>
                {promotion.isActive ? <FiEye /> : <FiEyeOff />}
              </button>
            ))}
            {!catalog.promotions.length ? (
              <div className="catalog-editorEmpty"><FiZap /><span>Crie o primeiro card para destacar uma oferta na entrada do cardápio.</span></div>
            ) : null}
          </div>
          <form className="catalog-promotionEditor" onSubmit={savePromotion}>
            <div className={`catalog-promotionPreview is-${promotionDraft.tone}`}>
              {promotionDraft.imageSrc ? <img src={promotionDraft.imageSrc} alt="" /> : null}
              <div>
                <small>{promotionDraft.eyebrow || 'Oferta especial'}</small>
                <strong>{promotionDraft.title || 'Título da campanha'}</strong>
                <p>{promotionDraft.subtitle || 'Uma mensagem curta e convidativa para o cliente.'}</p>
                <span>{promotionDraft.ctaLabel || 'Ver oferta'} →</span>
              </div>
            </div>
            <div className="catalog-managerFields">
              <label><span>Selo superior</span><input required value={promotionDraft.eyebrow} onChange={(event) => setPromotionDraft((current) => ({ ...current, eyebrow: event.target.value }))} placeholder="Oferta especial" /></label>
              <label><span>Estilo</span><select value={promotionDraft.tone} onChange={(event) => setPromotionDraft((current) => ({ ...current, tone: event.target.value as PromotionCard['tone'] }))}><option value="dark">Grafite</option><option value="rose">Rosé</option><option value="cream">Claro</option></select></label>
              <label className="is-wide"><span>Título</span><input required value={promotionDraft.title} onChange={(event) => setPromotionDraft((current) => ({ ...current, title: event.target.value, id: editingPromotionId ? current.id : slug(event.target.value) }))} placeholder="Doce do dia com preço especial" /></label>
              <label className="is-wide"><span>Mensagem curta</span><textarea rows={2} value={promotionDraft.subtitle} onChange={(event) => setPromotionDraft((current) => ({ ...current, subtitle: event.target.value }))} placeholder="Conte em uma frase por que vale a pena pedir." /></label>
              <label><span>Produto vinculado</span><select required value={promotionDraft.productId} onChange={(event) => {
                const product = catalog.products.find((item) => item.id === event.target.value)
                setPromotionDraft((current) => ({ ...current, productId: event.target.value, imageSrc: current.imageSrc || product?.imageSrc || '' }))
              }}><option value="">Selecione...</option>{catalog.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>
              <label><span>Texto do botão</span><input required value={promotionDraft.ctaLabel} onChange={(event) => setPromotionDraft((current) => ({ ...current, ctaLabel: event.target.value }))} /></label>
              <label className="is-wide"><span>Imagem do card</span><input value={promotionDraft.imageSrc} onChange={(event) => setPromotionDraft((current) => ({ ...current, imageSrc: event.target.value }))} placeholder="URL da imagem — usa a do produto automaticamente" /></label>
              <label className="catalog-promotionToggle is-wide"><input type="checkbox" checked={promotionDraft.isActive} onChange={(event) => setPromotionDraft((current) => ({ ...current, isActive: event.target.checked }))} /><span><strong>Card ativo</strong><small>Exibir na entrada do cardápio</small></span></label>
            </div>
            <div className="catalog-categoryActions">
              <button className="manager-primaryAction" type="submit"><FiCheck /> {editingPromotionId ? 'Atualizar promoção' : 'Criar promoção'}</button>
              {editingPromotionId ? <button className="is-danger" type="button" onClick={removePromotion}><FiTrash2 /> Excluir</button> : null}
            </div>
          </form>
        </div>
      </section> : null}

      {activeCatalogArea === 'products' ? <div className="catalog-managerWorkspace" id="produtos">
        <aside className="catalog-managerList">
          <label><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto..." /></label>
          <small>{loading ? 'Carregando…' : `${filtered.length} itens encontrados`}</small>
          <div>
            {filtered.map((product) => (
              <article className={selectedId === product.id ? 'is-active' : ''} key={product.id}>
                <button type="button" className="catalog-managerSelect" onClick={() => choose(product)}>
                  <span>{product.imageSrc ? <img src={product.imageSrc} alt="" loading="lazy" decoding="async" /> : <FiBox />}</span>
                  <div><strong>{product.name}</strong><small>{formatCurrency(product.basePrice)}</small></div>
                </button>
                <button type="button" className={product.isAvailable ? 'is-online' : ''} onClick={() => toggleAvailability(product)} title="Alterar disponibilidade">
                  {product.isAvailable ? <FiEye /> : <FiEyeOff />}
                </button>
              </article>
            ))}
          </div>
        </aside>

        <form className="catalog-managerEditor" onSubmit={saveProduct}>
          <header>
            <div><span>{selectedId ? 'Editando produto' : 'Novo produto'}</span><h2>{draft.name || 'Produto sem nome'}</h2></div>
            <div className="catalog-productHeaderActions">
              <span className="catalog-productCompletion">
                <b>{productFormCompletion}/5</b>
                <span><strong>{productFormCompletion === 5 ? 'Pronto para publicar' : 'Complete o essencial'}</strong><small>nome, preço, descrição, foto e categoria</small></span>
              </span>
              {selectedId ? <button type="button" onClick={duplicate}><FiCopy /> Duplicar</button> : null}
              {selectedId ? <button type="button" className="is-danger" onClick={removeProduct}><FiTrash2 /> Excluir</button> : null}
            </div>
          </header>

          <section className="catalog-managerFormSection">
            <header>
              <div><span>01</span><div><h3>Informações do item</h3><p>O essencial que o cliente verá no cardápio.</p></div></div>
            </header>
            <div className="catalog-managerFormLayout">
              <div className="catalog-managerFields">
                <label className="is-wide"><span>Nome do produto</span><input required value={draft.name} placeholder="Ex.: Cesta Café da Manhã" onChange={(event) => {
                  patchDraft('name', event.target.value)
                  if (!selectedId && !draft.id) patchDraft('id', slug(event.target.value))
                }} /></label>
                <label><span>Preço base</span><input required inputMode="decimal" value={draft.basePrice} onChange={(event) => patchDraft('basePrice', event.target.value)} placeholder="39,90" /></label>
                <label><span>Tipo de entrega</span><select value={draft.fulfillmentType} onChange={(event) => patchDraft('fulfillmentType', event.target.value as Product['fulfillmentType'])}><option value="encomenda">Encomenda</option><option value="entrega-pronta">Entrega pronta</option></select></label>
                <label className="is-wide"><span>Descrição</span><textarea required rows={4} value={draft.description} onChange={(event) => patchDraft('description', event.target.value)} placeholder="Conte o que acompanha o produto e por que ele é especial." /></label>
                <label><span>ID único</span><input required value={draft.id} onChange={(event) => patchDraft('id', slug(event.target.value))} /></label>
                <label><span>Texto do preço (opcional)</span><input value={draft.price} onChange={(event) => patchDraft('price', event.target.value)} placeholder="Ex.: a partir de R$ 39,90" /></label>
              </div>
              <aside className="catalog-managerImageField">
                <div>{draft.imageSrc ? <img src={draft.imageSrc} alt="" /> : <><FiImage /><span>Prévia da imagem</span></>}</div>
                <label><span>URL da imagem</span><input value={draft.imageSrc} onChange={(event) => patchDraft('imageSrc', event.target.value)} placeholder="https://..." /></label>
              </aside>
            </div>
          </section>

          <section className="catalog-managerFormSection catalog-managerFormSection--compact">
            <header><div><span>02</span><div><h3>Publicação</h3><p>Defina como este item aparece na loja.</p></div></div></header>
            <div className="catalog-managerChecks">
              <label><input type="checkbox" checked={draft.isAvailable} onChange={(event) => patchDraft('isAvailable', event.target.checked)} /><span><strong>Disponível</strong><small>Visível para compra</small></span></label>
              <label><input type="checkbox" checked={draft.isFeatured} onChange={(event) => patchDraft('isFeatured', event.target.checked)} /><span><strong>Destaque</strong><small>Maior relevância</small></span></label>
              <label><input type="checkbox" checked={draft.isPromo} onChange={(event) => patchDraft('isPromo', event.target.checked)} /><span><strong>Promoção</strong><small>Exibe selo no card</small></span></label>
            </div>
          </section>

          <section className="catalog-managerSection">
            <header>
              <div className="catalog-managerSectionTitle">
                <span>03</span>
                <div><h3>Categorias</h3><p>Ajude o cliente a encontrar este item.</p></div>
              </div>
            </header>
            <div className="catalog-managerChips">{catalog.categories.map((category) => <button type="button" className={draft.categoryIds.includes(category.id) ? 'is-active' : ''} key={category.id} onClick={() => toggleCategory(category)}>{category.name}</button>)}</div>
          </section>

          <section className="catalog-managerSection">
            <header>
              <div className="catalog-managerSectionTitle">
                <span>04</span>
                <div><h3>Variações e tamanhos</h3><p>Preços diferentes para tamanhos, sabores ou combos.</p></div>
              </div>
              <button type="button" onClick={() => patchDraft('options', [...draft.options, { id: '', label: '', quantityLabel: '', price: draft.basePrice }])}><FiPlus /> Adicionar variação</button>
            </header>
            <div className="catalog-optionEditorList">
              {draft.options.map((option, index) => (
                <article className="catalog-optionEditor" key={index}>
                  <header>
                    <div>
                      <strong>{option.label || `Variação ${index + 1}`}</strong>
                      <small>{option.price ? formatCurrency(money(option.price)) : 'Informe o preço'}</small>
                    </div>
                    <button type="button" aria-label={`Excluir ${option.label || `variação ${index + 1}`}`} onClick={() => patchDraft('options', draft.options.filter((_, itemIndex) => itemIndex !== index))}><FiTrash2 /></button>
                  </header>
                  <div className="catalog-inlineFields catalog-inlineFields--option">
                    <label>
                      <span>Nome da variação</span>
                      <input placeholder="Ex.: Grande" value={option.label} onChange={(event) => patchOption(index, { label: event.target.value, id: option.id || slug(event.target.value) })} />
                    </label>
                    <label>
                      <span>Descrição curta</span>
                      <input placeholder="Ex.: Serve 4 pessoas" value={option.quantityLabel ?? ''} onChange={(event) => patchOption(index, { quantityLabel: event.target.value })} />
                    </label>
                    <label>
                      <span>Preço</span>
                      <div className="catalog-moneyInput"><span>R$</span><input inputMode="decimal" placeholder="0,00" value={option.price} onChange={(event) => patchOption(index, { price: event.target.value })} /></div>
                    </label>
                  </div>
                </article>
              ))}
              {!draft.options.length ? <div className="catalog-editorEmpty"><FiLayers /><span>Nenhuma variação cadastrada. Adicione somente se o produto tiver tamanhos ou versões diferentes.</span></div> : null}
            </div>
          </section>

          <section className="catalog-managerSection catalog-managerSection--extras">
            <header>
              <div className="catalog-managerSectionTitle">
                <span>05</span>
                <div><h3>Complementos</h3><p>Edite o nome e o preço adicional cobrado neste produto.</p></div>
              </div>
              <button type="button" onClick={() => patchDraft('extras', [...draft.extras, { id: '', label: '', price: '' }])}><FiPlus /> Novo complemento</button>
            </header>
            {reusableExtras.length ? (
              <div className="catalog-extraLibrary">
                <div className="catalog-extraLibraryTitle">
                  <span><FiLayers /></span>
                  <div><strong>Biblioteca de complementos</strong><small>Clique para usar neste produto. Os valores continuam editáveis.</small></div>
                  <button type="button" onClick={reuseAllExtras}>Adicionar todos</button>
                </div>
                <div className="catalog-extraLibraryGrid">
                  {reusableExtras.map((extra) => {
                    const added = hasExtra(extra)
                    return (
                      <button type="button" className={added ? 'is-added' : ''} disabled={added} key={`${slug(extra.label)}-${extra.price}`} onClick={() => reuseExtra(extra)} title={`Usado em: ${extra.sourceProducts.join(', ')}`}>
                        <span>{added ? <FiCheck /> : <FiPlus />}</span>
                        <div><strong>{extra.label}</strong><small>{formatCurrency(extra.price)} · {extra.sourceProducts.length} {extra.sourceProducts.length === 1 ? 'produto' : 'produtos'}</small></div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : (
              <div className="catalog-extraLibraryEmpty"><FiLayers /><span>Quando você cadastrar complementos, eles aparecerão aqui para reutilização.</span></div>
            )}
            <div className="catalog-extraEditorList">
              {draft.extras.map((extra, index) => (
                <article className="catalog-extraEditor" key={index}>
                  <header>
                    <div>
                      <span>Complemento {String(index + 1).padStart(2, '0')}</span>
                      <strong>{extra.label || 'Novo complemento'}</strong>
                    </div>
                    <div>
                      <small>{extra.price ? `Adicional de ${formatCurrency(money(extra.price))}` : 'Preço ainda não informado'}</small>
                      <button type="button" aria-label={`Excluir ${extra.label || `complemento ${index + 1}`}`} title="Excluir complemento" onClick={() => removeExtra(index)}><FiTrash2 /></button>
                    </div>
                  </header>
                  <div className="catalog-inlineFields catalog-inlineFields--extra">
                    <label>
                      <span>Nome do complemento</span>
                      <input required placeholder="Ex.: Morango" value={extra.label} onChange={(event) => renameExtra(index, event.target.value)} />
                    </label>
                    <label>
                      <span>Preço adicional</span>
                      <div className="catalog-moneyInput"><span>R$</span><input required inputMode="decimal" placeholder="0,00" value={extra.price} onChange={(event) => patchExtra(index, { price: event.target.value })} /></div>
                    </label>
                  </div>
                  <p>Altere os campos acima e clique em <strong>Salvar e publicar</strong> no final do formulário.</p>
                </article>
              ))}
              {!draft.extras.length ? <div className="catalog-editorEmpty"><FiLayers /><span>Nenhum complemento neste produto. Clique em “Novo complemento” ou reutilize um item da biblioteca.</span></div> : null}
            </div>
          </section>

          <section className="catalog-managerSection catalog-managerSection--groups">
            <header>
              <div className="catalog-managerSectionTitle">
                <span>06</span>
                <div><h3>Grupos de complementos</h3><p>Organize as escolhas como no iFood e defina quantos itens o cliente pode selecionar.</p></div>
              </div>
              <button
                type="button"
                disabled={!draft.extras.length}
                onClick={() => patchDraft('extraGroups', [
                  ...draft.extraGroups,
                  {
                    id: `grupo-${draft.extraGroups.length + 1}`,
                    label: '',
                    minSelections: '0',
                    maxSelections: '1',
                    extraIds: [],
                  },
                ])}
              >
                <FiPlus /> Novo grupo
              </button>
            </header>

            <div className="catalog-extraGroupList">
              {draft.extraGroups.map((group, groupIndex) => (
                <article className="catalog-extraGroupEditor" key={groupIndex}>
                  <header>
                    <div>
                      <span>Grupo {String(groupIndex + 1).padStart(2, '0')}</span>
                      <strong>{group.label || 'Grupo sem nome'}</strong>
                      <small>
                        Opcional · até {group.maxSelections || '1'} escolha(s)
                      </small>
                    </div>
                    <button
                      type="button"
                      aria-label={`Excluir ${group.label || `grupo ${groupIndex + 1}`}`}
                      onClick={() => patchDraft(
                        'extraGroups',
                        draft.extraGroups.filter((_, index) => index !== groupIndex),
                      )}
                    >
                      <FiTrash2 />
                    </button>
                  </header>

                  <div className="catalog-extraGroupSettings">
                    <label className="is-wide">
                      <span>Nome exibido ao cliente</span>
                      <input
                        required
                        placeholder="Ex.: Escolha sua fruta"
                        value={group.label}
                        onChange={(event) => patchExtraGroup(groupIndex, {
                          label: event.target.value,
                          id: group.id || slug(event.target.value),
                        })}
                      />
                    </label>
                    <label>
                      <span>Máximo</span>
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, group.extraIds.length)}
                        value={group.maxSelections}
                        onChange={(event) => patchExtraGroup(groupIndex, { maxSelections: event.target.value })}
                      />
                    </label>
                  </div>

                  <div className="catalog-extraGroupChoices">
                    <div>
                      <strong>Complementos deste grupo</strong>
                      <small>Cada complemento pode pertencer a apenas um grupo.</small>
                    </div>
                    <div>
                      {draft.extras.map((extra, extraIndex) => {
                        const isSelected = group.extraIds.includes(extra.id)
                        const belongsElsewhere = draft.extraGroups.some(
                          (savedGroup, savedIndex) =>
                            savedIndex !== groupIndex && savedGroup.extraIds.includes(extra.id),
                        )
                        return (
                          <label className={isSelected ? 'is-selected' : ''} key={`${extra.id || 'novo'}-${extraIndex}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!extra.id || !extra.label.trim()}
                              onChange={() => toggleGroupExtra(groupIndex, extra.id)}
                            />
                            <span>
                              <strong>{extra.label || 'Complemento sem nome'}</strong>
                              <small>
                                {extra.price ? formatCurrency(money(extra.price)) : 'Sem preço'}
                                {belongsElsewhere ? ' · mover para este grupo' : ''}
                              </small>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                </article>
              ))}
              {!draft.extraGroups.length ? (
                <div className="catalog-editorEmpty">
                  <FiLayers />
                  <span>
                    {draft.extras.length
                      ? 'Crie um grupo e selecione os complementos que farão parte dele.'
                      : 'Cadastre pelo menos um complemento antes de criar grupos.'}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          <footer><span>{selectedId ? 'Alterações substituem o item atual.' : 'Um novo item será criado.'}</span><button disabled={saving} type="submit" className="manager-primaryAction">{saving ? 'Salvando…' : 'Salvar e publicar'}</button></footer>
        </form>
      </div> : null}

      {activeCatalogArea === 'extras' ? <section className="catalog-extraManager" id="complementos">
        <header className="catalog-studioHeader">
          <div className="catalog-studioTitle">
            <span className="catalog-studioIcon"><FiLayers /></span>
            <div><small>Estúdio de personalização</small><h2>Complementos</h2><p>Crie adicionais reutilizáveis e controle onde cada escolha aparece.</p></div>
          </div>
          <div className="catalog-studioHeaderActions">
            <span><strong>{reusableExtras.length}</strong> cadastrados</span>
            <span><strong>{reusableExtras.filter((extra) => extra.sourceProducts.length).length}</strong> em uso</span>
          </div>
        </header>
        <div className="catalog-extraManagerBody">
          <div className="catalog-extraManagerList">
            <label className="catalog-studioSearch">
              <FiSearch />
              <input
                value={extraSearch}
                onChange={(event) => setExtraSearch(event.target.value)}
                placeholder="Buscar complemento..."
              />
            </label>
            <div className="catalog-studioListMeta">
              <span>Biblioteca</span>
              <small>{filteredExtras.length} resultado(s)</small>
            </div>
            {filteredExtras.map((extra) => (
              <button type="button" className={editingExtraId === extra.id ? 'is-active' : ''} key={extra.id} onClick={() => chooseExtra(extra)}>
                <span className="catalog-studioAvatar">{extra.label.slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{extra.label}</strong>
                  <small>{formatCurrency(extra.price)}</small>
                  <em className={extra.sourceProducts.length ? 'is-linked' : ''}>
                    <FiLink /> {extra.sourceProducts.length
                      ? `${extra.sourceProducts.length} produto(s)`
                      : 'Ainda não utilizado'}
                  </em>
                </span>
                <FiEdit3 className="catalog-studioEditIcon" />
              </button>
            ))}
            {!filteredExtras.length ? <div className="catalog-editorEmpty"><FiLayers /><span>{extraSearch ? 'Nenhum complemento encontrado.' : 'Nenhum complemento cadastrado.'}</span></div> : null}
          </div>
          <form className="catalog-extraManagerForm" onSubmit={saveExtra}>
            <div className="catalog-studioEditorHeader">
              <span className="catalog-studioPreviewIcon"><FiTag /></span>
              <div>
                <small>{editingExtraId ? 'Editando complemento' : 'Novo complemento'}</small>
                <h3>{extraDraft.label || 'Dê um nome ao adicional'}</h3>
                <p>{extraDraft.price ? `Adiciona ${formatCurrency(money(extraDraft.price))} ao item` : 'Defina o nome e o valor cobrado.'}</p>
              </div>
            </div>
            <div className="catalog-managerFields">
              <label className="is-wide"><span>Nome exibido para o cliente</span><input required placeholder="Ex.: Morango extra" value={extraDraft.label} onChange={(event) => setExtraDraft((current) => ({ ...current, label: event.target.value, id: editingExtraId ? current.id : slug(event.target.value) }))} /></label>
              <label><span>Preço adicional</span><div className="catalog-moneyInput"><span>R$</span><input required inputMode="decimal" placeholder="0,00" value={extraDraft.price} onChange={(event) => setExtraDraft((current) => ({ ...current, price: event.target.value }))} /></div></label>
              <label><span>Identificador interno</span><div className="catalog-idInput"><FiHash /><input required value={extraDraft.id} onChange={(event) => setExtraDraft((current) => ({ ...current, id: slug(event.target.value) }))} /></div></label>
            </div>
            <div className="catalog-studioImpact">
              <FiPackage />
              <div>
                <strong>Impacto no cardápio</strong>
                {editingExtraId && reusableExtras.find((extra) => extra.id === editingExtraId)?.sourceProducts.length ? (
                  <p>Este complemento aparece em {reusableExtras.find((extra) => extra.id === editingExtraId)?.sourceProducts.join(', ')}. A atualização será aplicada em todos eles.</p>
                ) : (
                  <p>Depois de criar, vincule este complemento aos produtos ou grupos de escolha.</p>
                )}
              </div>
            </div>
            <div className="catalog-extraManagerActions">
              <button type="submit" className="manager-primaryAction"><FiCheck /> {editingExtraId ? 'Atualizar complemento' : 'Criar complemento'}</button>
              {editingExtraId ? <button type="button" className="is-danger" onClick={removeLibraryExtra}><FiTrash2 /> Excluir</button> : null}
            </div>
          </form>
        </div>
      </section> : null}

      {activeCatalogArea === 'categories' ? <section className="catalog-categoryManager" id="categorias">
        <header className="catalog-studioHeader">
          <div className="catalog-studioTitle">
            <span className="catalog-studioIcon catalog-studioIcon--category"><FiGrid /></span>
            <div><small>Organização da vitrine</small><h2>Categorias</h2><p>Agrupe produtos e acompanhe quais seções estão visíveis para o cliente.</p></div>
          </div>
          <div className="catalog-studioHeaderActions">
            <span><strong>{catalog.categories.length}</strong> categorias</span>
            <span><strong>{categoryInsights.filter((category) => category.visibleCount).length}</strong> visíveis</span>
          </div>
        </header>
        <div className="catalog-categoryBody">
          <div className="catalog-categoryList">
            <label className="catalog-studioSearch">
              <FiSearch />
              <input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="Buscar categoria..." />
            </label>
            <div className="catalog-studioListMeta"><span>Seções da loja</span><small>{filteredCategories.length} resultado(s)</small></div>
            <div className="catalog-categoryCards">
              {filteredCategories.map((category, index) => (
                <button type="button" className={editingCategoryId === category.id ? 'is-active' : ''} key={category.id} onClick={() => { setEditingCategoryId(category.id); setCategoryDraft(category) }}>
                  <span className={`catalog-categoryAvatar catalog-categoryAvatar--${index % 4}`}><FiGrid /></span>
                  <span>
                    <strong>{category.name}</strong>
                    <small>{category.shortLabel || `#${category.id}`}</small>
                    <em className={category.visibleCount ? 'is-visible' : ''}>
                      {category.visibleCount ? <FiEye /> : <FiEyeOff />}
                      {category.visibleCount ? `${category.visibleCount} visível(is)` : 'Oculta na loja'}
                    </em>
                  </span>
                  <b>{category.productCount}</b>
                </button>
              ))}
            </div>
            {!filteredCategories.length ? <div className="catalog-editorEmpty"><FiGrid /><span>{categorySearch ? 'Nenhuma categoria encontrada.' : 'Crie a primeira categoria da loja.'}</span></div> : null}
          </div>
          <div className="catalog-categoryEditor">
            <div className="catalog-studioEditorHeader">
              <span className="catalog-studioPreviewIcon"><FiGrid /></span>
              <div><small>{editingCategoryId ? 'Editando categoria' : 'Nova categoria'}</small><h3>{categoryDraft.name || 'Nome da nova seção'}</h3><p>{categoryDraft.shortLabel || 'A descrição ajuda o cliente a entender o que encontrará aqui.'}</p></div>
            </div>
            <div className="catalog-categoryPreview">
              <small>Prévia no cardápio</small>
              <div><span>{categoryDraft.name || 'Nome da categoria'}</span><b>{editingCategoryId ? categoryInsights.find((category) => category.id === editingCategoryId)?.visibleCount ?? 0 : 0}</b></div>
            </div>
            <div className="catalog-managerFields">
              <label className="is-wide"><span>Nome exibido</span><input placeholder="Ex.: Bolos para festa" value={categoryDraft.name} onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value, id: current.id || slug(event.target.value) }))} /></label>
              <label className="is-wide"><span>Descrição curta</span><input placeholder="Ex.: Celebre com sabores especiais" value={categoryDraft.shortLabel} onChange={(event) => setCategoryDraft((current) => ({ ...current, shortLabel: event.target.value }))} /></label>
              <label className="is-wide"><span>Identificador interno</span><div className="catalog-idInput"><FiHash /><input value={categoryDraft.id} onChange={(event) => setCategoryDraft((current) => ({ ...current, id: slug(event.target.value) }))} /></div></label>
            </div>
            <div className="catalog-categoryActions"><button type="button" className="manager-primaryAction" onClick={saveCategory}>Salvar categoria</button>{editingCategoryId ? <button type="button" className="is-danger" onClick={removeCategory}>Excluir</button> : null}</div>
          </div>
        </div>
      </section> : null}
    </section>
  )
}
