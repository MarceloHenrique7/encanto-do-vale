import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  FiBox,
  FiCopy,
  FiEdit3,
  FiCheck,
  FiEye,
  FiEyeOff,
  FiImage,
  FiLayers,
  FiPlus,
  FiSearch,
  FiTrash2,
} from 'react-icons/fi'

import type {
  Category,
  Product,
  ProductExtra,
  ProductOption,
} from '@/domain/catalog'
import { refreshCatalog } from '@/features/catalog/catalogStore'
import { formatCurrency } from '@/lib/formatters'

type Catalog = { products: Product[]; categories: Category[] }
type DraftProduct = Omit<Product, 'basePrice' | 'options' | 'extras'> & {
  basePrice: string
  options: Array<Omit<ProductOption, 'price'> & { price: string }>
  extras: Array<Omit<ProductExtra, 'price'> & { price: string }>
}

const emptyCatalog: Catalog = { products: [], categories: [] }

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
  }
}

function productPayload(draft: DraftProduct) {
  return {
    ...draft,
    id: draft.id || slug(draft.name),
    basePrice: money(draft.basePrice),
    options: draft.options.map((option) => ({ ...option, price: money(option.price) })),
    extras: draft.extras.map((extra) => ({ ...extra, price: money(extra.price) })),
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
    const library = new Map<
      string,
      ProductExtra & { sourceProducts: string[] }
    >()

    catalog.products
      .filter((product) => product.id !== selectedId)
      .forEach((product) => {
        product.extras?.forEach((extra) => {
          const key = `${slug(extra.label)}:${extra.price.toFixed(2)}`
          const saved = library.get(key)
          if (saved) {
            saved.sourceProducts.push(product.name)
          } else {
            library.set(key, { ...extra, sourceProducts: [product.name] })
          }
        })
      })

    return [...library.values()].sort((first, second) =>
      first.label.localeCompare(second.label, 'pt-BR'),
    )
  }, [catalog.products, selectedId])

  function choose(product: Product) {
    setSelectedId(product.id)
    setDraft(productDraft(product))
    setMessage('')
  }

  function createProduct() {
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

  return (
    <section className="catalog-manager">
      <div className="catalog-managerHero">
        <div>
          <span>Catálogo da loja</span>
          <h1>Produtos e categorias</h1>
          <p>As alterações são publicadas na vitrine e usadas no cálculo seguro do checkout.</p>
        </div>
        <button type="button" className="manager-primaryAction" onClick={createProduct}>
          <FiPlus /> Novo produto
        </button>
      </div>

      <div className="catalog-managerMetrics">
        <article><FiBox /><strong>{catalog.products.length}</strong><span>produtos</span></article>
        <article><FiEye /><strong>{catalog.products.filter((item) => item.isAvailable).length}</strong><span>disponíveis</span></article>
        <article><FiEyeOff /><strong>{catalog.products.filter((item) => !item.isAvailable).length}</strong><span>pausados</span></article>
        <article><strong>{catalog.categories.length}</strong><span>categorias</span></article>
      </div>

      {message ? <p className="catalog-managerMessage">{message}</p> : null}

      <div className="catalog-managerWorkspace">
        <aside className="catalog-managerList">
          <label><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto..." /></label>
          <small>{loading ? 'Carregando…' : `${filtered.length} itens encontrados`}</small>
          <div>
            {filtered.map((product) => (
              <article className={selectedId === product.id ? 'is-active' : ''} key={product.id}>
                <button type="button" className="catalog-managerSelect" onClick={() => choose(product)}>
                  <span>{product.imageSrc ? <img src={product.imageSrc} alt="" /> : <FiBox />}</span>
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
            <div>
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
            <header><div><h3>Categorias</h3><p>Ajude o cliente a encontrar este item.</p></div></header>
            <div className="catalog-managerChips">{catalog.categories.map((category) => <button type="button" className={draft.categoryIds.includes(category.id) ? 'is-active' : ''} key={category.id} onClick={() => toggleCategory(category)}>{category.name}</button>)}</div>
          </section>

          <section className="catalog-managerSection">
            <header><div><h3>Variações e tamanhos</h3><p>Preços diferentes para tamanhos, sabores ou combos.</p></div><button type="button" onClick={() => patchDraft('options', [...draft.options, { id: '', label: '', quantityLabel: '', price: draft.basePrice }])}><FiPlus /> Adicionar</button></header>
            {draft.options.map((option, index) => <div className="catalog-managerRow" key={index}>
              <input placeholder="Nome da opção" value={option.label} onChange={(event) => patchDraft('options', draft.options.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value, id: item.id || slug(event.target.value) } : item))} />
              <input placeholder="Descrição curta" value={option.quantityLabel ?? ''} onChange={(event) => patchDraft('options', draft.options.map((item, itemIndex) => itemIndex === index ? { ...item, quantityLabel: event.target.value } : item))} />
              <input placeholder="Preço" value={option.price} onChange={(event) => patchDraft('options', draft.options.map((item, itemIndex) => itemIndex === index ? { ...item, price: event.target.value } : item))} />
              <button type="button" onClick={() => patchDraft('options', draft.options.filter((_, itemIndex) => itemIndex !== index))}><FiTrash2 /></button>
            </div>)}
          </section>

          <section className="catalog-managerSection">
            <header><div><h3>Complementos</h3><p>Reutilize opções já cadastradas ou crie uma nova.</p></div><button type="button" onClick={() => patchDraft('extras', [...draft.extras, { id: '', label: '', price: '' }])}><FiPlus /> Novo complemento</button></header>
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
            {draft.extras.map((extra, index) => <div className="catalog-managerRow catalog-managerRow--extra" key={index}>
              <input placeholder="Nome do adicional" value={extra.label} onChange={(event) => patchDraft('extras', draft.extras.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value, id: item.id || slug(event.target.value) } : item))} />
              <input placeholder="Preço" value={extra.price} onChange={(event) => patchDraft('extras', draft.extras.map((item, itemIndex) => itemIndex === index ? { ...item, price: event.target.value } : item))} />
              <button type="button" onClick={() => patchDraft('extras', draft.extras.filter((_, itemIndex) => itemIndex !== index))}><FiTrash2 /></button>
            </div>)}
          </section>

          <footer><span>{selectedId ? 'Alterações substituem o item atual.' : 'Um novo item será criado.'}</span><button disabled={saving} type="submit" className="manager-primaryAction">{saving ? 'Salvando…' : 'Salvar e publicar'}</button></footer>
        </form>
      </div>

      <section className="catalog-categoryManager">
        <header><div><span>Organização</span><h2>Gerenciar categorias</h2></div><button type="button" onClick={() => { setEditingCategoryId(''); setCategoryDraft({ id: '', name: '', shortLabel: '' }) }}><FiPlus /> Nova categoria</button></header>
        <div className="catalog-categoryBody">
          <div>{catalog.categories.map((category) => <button type="button" className={editingCategoryId === category.id ? 'is-active' : ''} key={category.id} onClick={() => { setEditingCategoryId(category.id); setCategoryDraft(category) }}><FiEdit3 /><span><strong>{category.name}</strong><small>{category.shortLabel || category.id}</small></span></button>)}</div>
          <div className="catalog-managerFields">
            <label><span>Nome</span><input value={categoryDraft.name} onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value, id: current.id || slug(event.target.value) }))} /></label>
            <label><span>ID</span><input value={categoryDraft.id} onChange={(event) => setCategoryDraft((current) => ({ ...current, id: slug(event.target.value) }))} /></label>
            <label className="is-wide"><span>Descrição curta</span><input value={categoryDraft.shortLabel} onChange={(event) => setCategoryDraft((current) => ({ ...current, shortLabel: event.target.value }))} /></label>
            <div className="catalog-categoryActions"><button type="button" className="manager-primaryAction" onClick={saveCategory}>Salvar categoria</button>{editingCategoryId ? <button type="button" className="is-danger" onClick={removeCategory}>Excluir</button> : null}</div>
          </div>
        </div>
      </section>
    </section>
  )
}
