import { FormEvent, useMemo, useState } from 'react'

import { categories } from '@/data/landing'
import type { Product, ProductOption } from '@/types/landing'
import {
  ADMIN_AUTH_STORAGE_KEY,
  buildLandingProductsSnippet,
  resetCatalogProducts,
  saveCatalogProducts,
  useCatalogProducts,
} from '@/utils/adminCatalog'

type ProductDraft = {
  id: string
  name: string
  description: string
  price: string
  basePrice: string
  imageSrc: string
  fulfillmentType: Product['fulfillmentType']
  isAvailable: boolean
  isFeatured: boolean
  isPromo: boolean
  primaryCategoryLabel: string
  categoryIds: string
  optionsText: string
}

const emptyDraft: ProductDraft = {
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
  primaryCategoryLabel: 'Cestas',
  categoryIds: 'cestas',
  optionsText: '',
}

function createSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function formatMoneyLabel(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function productToDraft(product: Product): ProductDraft {
  return {
    id: product.id,
    name: product.name,
    description: product.description.trim(),
    price: product.price,
    basePrice: String(product.basePrice).replace('.', ','),
    imageSrc: product.imageSrc,
    fulfillmentType: product.fulfillmentType,
    isAvailable: product.isAvailable,
    isFeatured: product.isFeatured,
    isPromo: product.isPromo,
    primaryCategoryLabel: product.primaryCategoryLabel,
    categoryIds: product.categoryIds.join(', '),
    optionsText:
      product.options
        ?.map((option) =>
          [
            option.id,
            option.label,
            option.quantityLabel ?? '',
            String(option.price).replace('.', ','),
          ].join('|'),
        )
        .join('\n') ?? '',
  }
}

function parseMoney(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function parseOptions(value: string): ProductOption[] | undefined {
  const options = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [id, label, quantityLabel, price] = line.split('|').map((item) => item.trim())

      return {
        id,
        label,
        quantityLabel: quantityLabel || undefined,
        price: parseMoney(price ?? '0'),
      }
    })
    .filter((option) => option.id && option.label && option.price > 0)

  return options.length ? options : undefined
}

function draftToProduct(draft: ProductDraft): Product {
  const basePrice = parseMoney(draft.basePrice)
  const price = draft.price.trim() || `A partir de ${formatMoneyLabel(basePrice)}`

  return {
    id: draft.id.trim() || createSlug(draft.name),
    name: draft.name.trim(),
    description: draft.description.trim(),
    price,
    basePrice,
    imageSrc: draft.imageSrc.trim(),
    fulfillmentType: draft.fulfillmentType,
    isAvailable: draft.isAvailable,
    isFeatured: draft.isFeatured,
    isPromo: draft.isPromo,
    primaryCategoryLabel: draft.primaryCategoryLabel.trim(),
    categoryIds: draft.categoryIds
      .split(',')
      .map((categoryId) => categoryId.trim())
      .filter(Boolean),
    options: parseOptions(draft.optionsText),
  }
}

export default function AdminPage() {
  const products = useCatalogProducts()
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => window.sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true',
  )
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '')
  const selectedProduct = products.find((product) => product.id === selectedProductId)
  const [draft, setDraft] = useState<ProductDraft>(() =>
    selectedProduct ? productToDraft(selectedProduct) : emptyDraft,
  )
  const [message, setMessage] = useState('')

  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD ?? 'encanto-admin'

  const exportedCode = useMemo(
    () => buildLandingProductsSnippet(products),
    [products],
  )

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password === adminPassword) {
      window.sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true')
      setIsAuthenticated(true)
      setMessage('')
      return
    }

    setMessage('Senha incorreta.')
  }

  function selectProduct(product: Product) {
    setSelectedProductId(product.id)
    setDraft(productToDraft(product))
    setMessage('')
  }

  function createNewProduct() {
    setSelectedProductId('')
    setDraft(emptyDraft)
    setMessage('')
  }

  function duplicateProduct(product: Product) {
    const nextDraft = productToDraft(product)
    nextDraft.id = `${product.id}-copia`
    nextDraft.name = `${product.name} copia`
    setSelectedProductId('')
    setDraft(nextDraft)
    setMessage('')
  }

  function updateDraft<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const product = draftToProduct(draft)

    if (!product.id || !product.name || !product.description || !product.basePrice) {
      setMessage('Preencha nome, descricao e preco.')
      return
    }

    if (!product.categoryIds.length) {
      setMessage('Informe pelo menos uma categoria.')
      return
    }

    const nextProducts = products.some((item) => item.id === product.id)
      ? products.map((item) => (item.id === product.id ? product : item))
      : [...products, product]

    saveCatalogProducts(nextProducts)
    setSelectedProductId(product.id)
    setDraft(productToDraft(product))
    setMessage('Produto salvo no admin.')
  }

  function deleteProduct(productId: string) {
    const nextProducts = products.filter((product) => product.id !== productId)
    saveCatalogProducts(nextProducts)
    setSelectedProductId(nextProducts[0]?.id ?? '')
    setDraft(nextProducts[0] ? productToDraft(nextProducts[0]) : emptyDraft)
    setMessage('Produto removido do admin.')
  }

  function resetProducts() {
    resetCatalogProducts()
    setSelectedProductId('')
    setDraft(emptyDraft)
    setMessage('Catalogo voltou para o landing.ts original.')
  }

  if (!isAuthenticated) {
    return (
      <main className="admin-page admin-page--login">
        <form className="admin-login" onSubmit={handleLogin}>
          <p className="section-label">Admin</p>
          <h1>Area restrita</h1>
          <p>
            Entre com a senha para cadastrar e editar os itens do cardapio.
          </p>

          <label className="admin-field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
          </label>

          {message ? <p className="admin-message">{message}</p> : null}

          <button type="submit" className="admin-primaryButton">
            Entrar
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="section-label">Admin</p>
          <h1>Produtos da landing</h1>
          <p>
            Cadastre, edite, remova e depois exporte o codigo para o
            `landing.ts`.
          </p>
        </div>

        <a className="admin-secondaryButton" href="/">
          Ver loja
        </a>
      </header>

      <section className="admin-layout">
        <aside className="admin-list">
          <div className="admin-listHeader">
            <strong>{products.length} itens</strong>
            <button type="button" onClick={createNewProduct}>
              Novo
            </button>
          </div>

          {products.map((product) => (
            <button
              type="button"
              className={`admin-listItem${product.id === selectedProductId ? ' is-active' : ''}`}
              key={product.id}
              onClick={() => selectProduct(product)}
            >
              <span>{product.name}</span>
              <small>{product.primaryCategoryLabel}</small>
            </button>
          ))}
        </aside>

        <form className="admin-form" onSubmit={handleSubmit}>
          <div className="admin-formGrid">
            <label className="admin-field">
              <span>Nome</span>
              <input
                value={draft.name}
                onChange={(event) => {
                  updateDraft('name', event.target.value)

                  if (!draft.id) {
                    updateDraft('id', createSlug(event.target.value))
                  }
                }}
              />
            </label>

            <label className="admin-field">
              <span>ID</span>
              <input
                value={draft.id}
                onChange={(event) => updateDraft('id', createSlug(event.target.value))}
              />
            </label>

            <label className="admin-field">
              <span>Preco base</span>
              <input
                inputMode="decimal"
                placeholder="149,90"
                value={draft.basePrice}
                onChange={(event) => updateDraft('basePrice', event.target.value)}
              />
            </label>

            <label className="admin-field">
              <span>Texto do preco</span>
              <input
                placeholder="A partir de R$ 149,90"
                value={draft.price}
                onChange={(event) => updateDraft('price', event.target.value)}
              />
            </label>

            <label className="admin-field">
              <span>Categoria principal</span>
              <input
                list="admin-category-labels"
                value={draft.primaryCategoryLabel}
                onChange={(event) =>
                  updateDraft('primaryCategoryLabel', event.target.value)
                }
              />
            </label>

            <label className="admin-field">
              <span>IDs das categorias</span>
              <input
                placeholder="cestas, dia-das-maes"
                value={draft.categoryIds}
                onChange={(event) => updateDraft('categoryIds', event.target.value)}
              />
            </label>
          </div>

          <datalist id="admin-category-labels">
            {categories.map((category) => (
              <option key={category.id} value={category.name} />
            ))}
          </datalist>

          <label className="admin-field">
            <span>Imagem URL</span>
            <input
              value={draft.imageSrc}
              onChange={(event) => updateDraft('imageSrc', event.target.value)}
            />
          </label>

          <label className="admin-field">
            <span>Descricao</span>
            <textarea
              rows={8}
              value={draft.description}
              onChange={(event) => updateDraft('description', event.target.value)}
            />
          </label>

          <div className="admin-formGrid admin-formGrid--compact">
            <label className="admin-field">
              <span>Atendimento</span>
              <select
                value={draft.fulfillmentType}
                onChange={(event) =>
                  updateDraft(
                    'fulfillmentType',
                    event.target.value as Product['fulfillmentType'],
                  )
                }
              >
                <option value="encomenda">Encomenda</option>
                <option value="entrega-pronta">Entrega pronta</option>
              </select>
            </label>

            <label className="admin-check">
              <input
                type="checkbox"
                checked={draft.isAvailable}
                onChange={(event) => updateDraft('isAvailable', event.target.checked)}
              />
              Disponivel
            </label>

            <label className="admin-check">
              <input
                type="checkbox"
                checked={draft.isFeatured}
                onChange={(event) => updateDraft('isFeatured', event.target.checked)}
              />
              Destaque
            </label>

            <label className="admin-check">
              <input
                type="checkbox"
                checked={draft.isPromo}
                onChange={(event) => updateDraft('isPromo', event.target.checked)}
              />
              Promocao
            </label>
          </div>

          <label className="admin-field">
            <span>Opcoes</span>
            <textarea
              rows={4}
              placeholder="caixa-4|Caixa com 4 brigadeiros|4 brigadeiros|10,00"
              value={draft.optionsText}
              onChange={(event) => updateDraft('optionsText', event.target.value)}
            />
          </label>

          {message ? <p className="admin-message">{message}</p> : null}

          <div className="admin-actions">
            <button type="submit" className="admin-primaryButton">
              Salvar produto
            </button>

            {selectedProduct ? (
              <>
                <button
                  type="button"
                  className="admin-secondaryButton"
                  onClick={() => duplicateProduct(selectedProduct)}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  className="admin-dangerButton"
                  onClick={() => deleteProduct(selectedProduct.id)}
                >
                  Excluir
                </button>
              </>
            ) : null}
          </div>
        </form>
      </section>

      <section className="admin-export">
        <div>
          <h2>Exportar para landing.ts</h2>
          <p>
            Use este bloco para substituir o `export const products` do arquivo
            quando quiser salvar no codigo do projeto.
          </p>
        </div>

        <textarea readOnly rows={10} value={exportedCode} />

        <div className="admin-actions">
          <button
            type="button"
            className="admin-secondaryButton"
            onClick={() => navigator.clipboard.writeText(exportedCode)}
          >
            Copiar codigo
          </button>
          <button type="button" className="admin-dangerButton" onClick={resetProducts}>
            Restaurar original
          </button>
        </div>
      </section>
    </main>
  )
}
