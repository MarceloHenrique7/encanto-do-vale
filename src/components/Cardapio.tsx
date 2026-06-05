import { useMemo, useState } from 'react'

import { categories } from '@/data/landing'
import type { Product } from '@/types/landing'

type CardapioProps = {
  products: Product[]
  onAddToCart: (productId: string, optionId: string | undefined, quantity: number) => void
}

type FulfillmentFilter = 'todos' | 'encomenda' | 'entrega-pronta'
type PriceOrder = 'default' | 'asc' | 'desc'

const fulfillmentLabels: Record<FulfillmentFilter, string> = {
  todos: 'Todos',
  encomenda: 'Encomenda',
  'entrega-pronta': 'Pronta entrega',
}

export default function Cardapio({ products, onAddToCart }: CardapioProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('todos')
  const [selectedFulfillment, setSelectedFulfillment] =
    useState<FulfillmentFilter>('todos')
  const [selectedPriceOrder, setSelectedPriceOrder] =
    useState<PriceOrder>('default')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string>>({})
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})
  const [confirmingProductId, setConfirmingProductId] = useState<string | null>(null)

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
  }

  function formatStartingPrice(value: number) {
    return `A partir de ${formatCurrency(value)}`
  }

  function normalize(text: string) {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  }

  function truncateDescription(text: string, maxLength = 88) {
    const cleanedText = text.replace(/\s+/g, ' ').trim()

    if (cleanedText.length <= maxLength) {
      return cleanedText
    }

    return `${cleanedText.slice(0, maxLength).trimEnd()}...`
  }

  function getSelectedOption(product: Product) {
    if (!product.options?.length) {
      return undefined
    }

    const selectedOptionId = selectedOptionIds[product.id]

    return (
      product.options.find((option) => option.id === selectedOptionId) ??
      product.options[0]
    )
  }

  function getUnitPrice(product: Product) {
    return getSelectedOption(product)?.price ?? product.basePrice
  }

  function getSelectedQuantity(productId: string) {
    return selectedQuantities[productId] ?? 1
  }

  function closeConfirmation() {
    setConfirmingProductId(null)
  }

  function resetFilters() {
    setSelectedCategoryId('todos')
    setSelectedFulfillment('todos')
    setSelectedPriceOrder('default')
    setSearchTerm('')
  }

  const availableProductsCount = products.filter((product) => product.isAvailable).length
  const readyProductsCount = products.filter(
    (product) => product.fulfillmentType === 'entrega-pronta',
  ).length

  const categoryCounts = useMemo(() => {
    return categories.reduce<Record<string, number>>((accumulator, category) => {
      if (category.id === 'destaques') {
        accumulator[category.id] = products.filter((product) => product.isFeatured).length
        return accumulator
      }

      accumulator[category.id] = products.filter((product) =>
        product.categoryIds.includes(category.id),
      ).length
      return accumulator
    }, {})
  }, [products])

  const filteredProducts = useMemo(() => {
    const normalizedSearch = normalize(searchTerm.trim())

    const filtered = products.filter((product) => {
      const matchesCategory =
        selectedCategoryId === 'todos' ||
        (selectedCategoryId === 'destaques'
          ? product.isFeatured
          : product.categoryIds.includes(selectedCategoryId))

      const matchesFulfillment =
        selectedFulfillment === 'todos' ||
        product.fulfillmentType === selectedFulfillment

      const matchesSearch =
        !normalizedSearch ||
        normalize(
          `${product.name} ${product.description} ${product.primaryCategoryLabel}`,
        ).includes(normalizedSearch)

      return matchesCategory && matchesFulfillment && matchesSearch
    })

    if (selectedPriceOrder === 'asc') {
      return [...filtered].sort(
        (first, second) => first.basePrice - second.basePrice,
      )
    }

    if (selectedPriceOrder === 'desc') {
      return [...filtered].sort(
        (first, second) => second.basePrice - first.basePrice,
      )
    }

    return filtered
  }, [products, searchTerm, selectedCategoryId, selectedFulfillment, selectedPriceOrder])

  const activeCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  )
  const activeCategoryName =
    selectedCategoryId === 'todos' ? 'Cardapio completo' : activeCategory?.name
  const confirmingProduct =
    products.find((product) => product.id === confirmingProductId) ?? null

  return (
    <main id="cardapio" className="menu-app">
      <section className="menu-hero">
        <div className="menu-hero-copy">
          <span className="menu-store-pill">Delivery artesanal</span>
          <h1>Encanto do Vale</h1>
          <p>
            Escolha seus doces, cestas e bolos pelo cardapio. Toque em um item
            para ver detalhes e adicionar ao carrinho.
          </p>
        </div>

        <div className="menu-hero-stats" aria-label="Resumo do cardapio">
          <div>
            <strong>{products.length}</strong>
            <span>itens</span>
          </div>
          <div>
            <strong>{categories.length}</strong>
            <span>categorias</span>
          </div>
          <div>
            <strong>{availableProductsCount}</strong>
            <span>disponiveis</span>
          </div>
        </div>
      </section>

      <section className="menu-workspace" id="encomende">
        <div className="menu-toolbar">
          <label className="menu-search">
            <span>Buscar no cardapio</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por bolo, cesta, chocolate..."
              type="search"
            />
          </label>

          <div className="menu-selects">
            <label className="menu-filterField">
              <span>Atendimento</span>
              <select
                value={selectedFulfillment}
                onChange={(event) =>
                  setSelectedFulfillment(event.target.value as FulfillmentFilter)
                }
              >
                <option value="todos">Todos</option>
                <option value="encomenda">Encomenda</option>
                <option value="entrega-pronta">Pronta entrega</option>
              </select>
            </label>

            <label className="menu-filterField">
              <span>Preco</span>
              <select
                value={selectedPriceOrder}
                onChange={(event) =>
                  setSelectedPriceOrder(event.target.value as PriceOrder)
                }
              >
                <option value="default">Padrao</option>
                <option value="asc">Menor preco</option>
                <option value="desc">Maior preco</option>
              </select>
            </label>
          </div>
        </div>

        <div className="menu-categoryRail" aria-label="Categorias do cardapio">
          <button
            type="button"
            className={`menu-categoryChip${selectedCategoryId === 'todos' ? ' is-active' : ''}`}
            onClick={() => setSelectedCategoryId('todos')}
          >
            <span>Todos</span>
            <small>{products.length}</small>
          </button>

          {categories.map((category) => (
            <button
              type="button"
              className={`menu-categoryChip${selectedCategoryId === category.id ? ' is-active' : ''}`}
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
            >
              <span>{category.name}</span>
              <small>{categoryCounts[category.id] ?? 0}</small>
            </button>
          ))}
        </div>

        <div className="menu-resultsHeader">
          <div>
            <span className="menu-panel-label">Mostrando agora</span>
            <h2>{activeCategoryName}</h2>
          </div>
          <div className="menu-resultsMeta">
            <span>{filteredProducts.length} itens</span>
            <span>{fulfillmentLabels[selectedFulfillment]}</span>
            <span>{readyProductsCount} pronta entrega</span>
          </div>
        </div>

        {filteredProducts.length ? (
          <div className="menu-grid">
            {filteredProducts.map((product) => (
              <article
                className={`menu-card${product.isPromo ? ' menu-card--promo' : ''}${product.isAvailable ? '' : ' menu-card--unavailable'}`}
                key={product.id}
              >
                <button
                  type="button"
                  className="menu-card-open"
                  onClick={() => setConfirmingProductId(product.id)}
                >
                  <span className="menu-card-imageWrap">
                    {product.imageSrc ? (
                      <img
                        src={product.imageSrc}
                        alt={product.name}
                        className="menu-card-image"
                      />
                    ) : (
                      <span className="menu-card-placeholder">sem foto</span>
                    )}

                    {product.isPromo ? (
                      <span className="menu-card-badge">Promo</span>
                    ) : null}
                  </span>

                  <span className="menu-card-content">
                    <span className="menu-card-topline">
                      <span className="menu-card-category">
                        {product.primaryCategoryLabel}
                      </span>
                      <span
                        className={`menu-card-status menu-card-status--${product.fulfillmentType}`}
                      >
                        {product.fulfillmentType === 'encomenda'
                          ? 'Encomenda'
                          : 'Pronta'}
                      </span>
                    </span>

                    <strong className="menu-card-title">{product.name}</strong>
                    <span className="menu-card-description">
                      {truncateDescription(product.description)}
                    </span>
                    <span className="menu-card-footer">
                      <strong className="menu-card-price">
                        {formatStartingPrice(product.basePrice)}
                      </strong>
                      <span
                        className={`menu-card-quickAction${product.isAvailable ? '' : ' is-disabled'}`}
                      >
                        {product.isAvailable ? '+' : 'Indisponivel'}
                      </span>
                    </span>
                  </span>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="menu-emptyState">
            <strong>Nenhum produto encontrado.</strong>
            <p>
              Tente limpar a busca ou escolher outra categoria para ver mais
              opcoes do cardapio.
            </p>
            <button type="button" onClick={resetFilters}>
              Limpar filtros
            </button>
          </div>
        )}
      </section>

      {confirmingProduct ? (
        <div className="product-confirmation-overlay">
          <button
            type="button"
            className="product-confirmation-backdrop"
            aria-label="Fechar confirmacao do produto"
            onClick={closeConfirmation}
          />

          <div
            className="product-confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-confirmation-title"
          >
            <div className="product-confirmation-media">
              {confirmingProduct.imageSrc ? (
                <img
                  src={confirmingProduct.imageSrc}
                  alt={confirmingProduct.name}
                  className="product-confirmation-image"
                />
              ) : (
                <div className="product-confirmation-placeholder">
                  imagem do produto
                </div>
              )}
            </div>

            <div className="product-confirmation-content">
              <div className="product-confirmation-header">
                <span className="menu-card-category">
                  {confirmingProduct.primaryCategoryLabel}
                </span>
                <button
                  type="button"
                  className="product-confirmation-close"
                  onClick={closeConfirmation}
                >
                  Fechar
                </button>
              </div>

              <h3 id="product-confirmation-title">{confirmingProduct.name}</h3>
              <strong className="product-confirmation-price">
                {formatStartingPrice(confirmingProduct.basePrice)}
              </strong>
              <p className="product-confirmation-description">
                {confirmingProduct.description}
              </p>

              <div className="menu-card-fulfillment">
                <span
                  className={`menu-card-fulfillmentBadge menu-card-fulfillmentBadge--${confirmingProduct.fulfillmentType}`}
                >
                  {confirmingProduct.fulfillmentType === 'encomenda'
                    ? 'Encomenda'
                    : 'Pronta entrega'}
                </span>
                <span className="menu-card-fulfillmentText">
                  {confirmingProduct.fulfillmentType === 'encomenda'
                    ? 'feito sob pedido com prazo combinado'
                    : 'produto pensado para entrega mais agil'}
                </span>
              </div>

              {confirmingProduct.options?.length ? (
                <div className="menu-card-optionGroup">
                  <label className="menu-card-field">
                    <span>Opcao</span>
                    <select
                      value={getSelectedOption(confirmingProduct)?.id ?? ''}
                      onChange={(event) =>
                        setSelectedOptionIds((current) => ({
                          ...current,
                          [confirmingProduct.id]: event.target.value,
                        }))
                      }
                    >
                      {confirmingProduct.options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} - {formatCurrency(option.price)}
                        </option>
                      ))}
                    </select>
                  </label>

                  {getSelectedOption(confirmingProduct)?.quantityLabel ? (
                    <span className="menu-card-fulfillmentText">
                      {getSelectedOption(confirmingProduct)?.quantityLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="product-confirmation-actions">
                <label className="menu-card-field">
                  <span>Quantidade</span>
                  <select
                    value={String(getSelectedQuantity(confirmingProduct.id))}
                    onChange={(event) =>
                      setSelectedQuantities((current) => ({
                        ...current,
                        [confirmingProduct.id]: Number(event.target.value),
                      }))
                    }
                    disabled={!confirmingProduct.isAvailable}
                  >
                    {Array.from({ length: 10 }, (_, index) => index + 1).map(
                      (quantity) => (
                        <option key={quantity} value={quantity}>
                          {quantity} unidade{quantity > 1 ? 's' : ''}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <p className="menu-card-total">
                  Total: {formatCurrency(
                    getUnitPrice(confirmingProduct) *
                      getSelectedQuantity(confirmingProduct.id),
                  )}
                </p>

                <div className="product-confirmation-buttons">
                  <button
                    type="button"
                    className="product-confirmation-secondary"
                    onClick={closeConfirmation}
                  >
                    Continuar vendo
                  </button>
                  <button
                    type="button"
                    className={`menu-card-cartButton${confirmingProduct.isAvailable ? '' : ' is-disabled'}`}
                    onClick={() => {
                      onAddToCart(
                        confirmingProduct.id,
                        getSelectedOption(confirmingProduct)?.id,
                        getSelectedQuantity(confirmingProduct.id),
                      )
                      closeConfirmation()
                    }}
                    disabled={!confirmingProduct.isAvailable}
                  >
                    {confirmingProduct.isAvailable
                      ? 'Adicionar ao carrinho'
                      : 'Item indisponivel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
