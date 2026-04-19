import { useMemo, useState } from 'react'

import { categories, products } from '@/data/landing'
import type { Product } from '@/types/landing'

type CardapioProps = {
  onAddToCart: (productId: string, optionId: string | undefined, quantity: number) => void
}

export default function Cardapio({ onAddToCart }: CardapioProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('dia-das-maes')
  const [selectedFulfillment, setSelectedFulfillment] = useState<
    'todos' | 'encomenda' | 'entrega-pronta'
  >('encomenda')
  const [selectedProductId, setSelectedProductId] = useState('todos')
  const [selectedPriceOrder, setSelectedPriceOrder] = useState<
    'default' | 'asc' | 'desc'
  >('asc')
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

  function truncateDescription(text: string, maxLength = 50) {
    if (text.length <= maxLength) {
      return text
    }

    return `${text.slice(0, maxLength).trimEnd()}...`
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
    setSelectedCategoryId('dia-das-maes')
    setSelectedFulfillment('encomenda')
    setSelectedProductId('todos')
    setSelectedPriceOrder('asc')
  }

  const categoryProducts = useMemo(() => {
    if (selectedCategoryId === 'todos') {
      return products
    }

    if (selectedCategoryId === 'destaques') {
      return products.filter((product) => product.isFeatured)
    }

    return products.filter((product) =>
      product.categoryIds.includes(selectedCategoryId),
    )
  }, [selectedCategoryId])

  const filteredProducts = useMemo(() => {
    const filtered = categoryProducts.filter((product) => {
      const matchesFulfillment =
        selectedFulfillment === 'todos' ||
        product.fulfillmentType === selectedFulfillment

      const matchesProduct =
        selectedProductId === 'todos' || product.id === selectedProductId

      return matchesFulfillment && matchesProduct
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
  }, [
    categoryProducts,
    selectedFulfillment,
    selectedPriceOrder,
    selectedProductId,
  ])

  const activeCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  )
  const activeCategoryName =
    selectedCategoryId === 'todos' ? 'Todos os produtos' : activeCategory?.name
  const isMothersDayCategory = selectedCategoryId === 'dia-das-maes'
  const confirmingProduct =
    products.find((product) => product.id === confirmingProductId) ?? null

  return (
    <section
      id="cardapio"
      className={`section menu-section${isMothersDayCategory ? ' menu-section--mothers-day' : ''}`}
    >
      <div className="menu-shell" id="encomende">
        <div className="menu-header">
          <div className="section-heading menu-heading">
            <p className="section-label">Cardapio</p>
            <h2>Encontre oque vai te fazer feliz hoje.</h2>
            <p className="menu-description">
              Selecione a categoria, refine por atendimento e escolha um
              produto especifico se quiser ir direto ao ponto.
            </p>
          </div>
        </div>

        {isMothersDayCategory ? (
          <div className="menu-mothers-day-banner" aria-label="Especial Dia das Maes">
            <span>Especial Dia das Maes</span>
            <strong>Cestas presenteaveis, chocolates e carinho em cada detalhe.</strong>
            <p>
              Escolha uma composicao especial e depois personalize preco,
              imagem e detalhes do presente.
            </p>
          </div>
        ) : null}

        <div className="menu-filters">
          <div className="menu-filters-bar">
            <span className="menu-filters-kicker">Refinar vitrine</span>
            <button
              type="button"
              className="menu-filters-reset"
              onClick={resetFilters}
            >
              Limpar
            </button>
          </div>

          <label className="menu-filterField">
            <span>Categoria</span>
            <select
              value={selectedCategoryId}
              onChange={(event) => {
                setSelectedCategoryId(event.target.value)
                setSelectedProductId('todos')
              }}
            >
              <option value="todos">Todos</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="menu-filterField">
            <span>Atendimento</span>
            <select
              value={selectedFulfillment}
              onChange={(event) =>
                setSelectedFulfillment(
                  event.target.value as 'todos' | 'encomenda' | 'entrega-pronta',
                )
              }
            >
              <option value="todos">Todos</option>
              <option value="encomenda">So encomenda</option>
              <option value="entrega-pronta">So entrega pronta</option>
            </select>
          </label>

          <label className="menu-filterField">
            <span>Produto</span>
            <select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
            >
              <option value="todos">Todos os produtos</option>
              {categoryProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </label>

          <label className="menu-filterField">
            <span>Preco</span>
            <select
              value={selectedPriceOrder}
              onChange={(event) =>
                setSelectedPriceOrder(
                  event.target.value as 'default' | 'asc' | 'desc',
                )
              }
            >
              <option value="default">Sem ordenacao</option>
              <option value="asc">Do menor para o maior</option>
              <option value="desc">Do maior para o menor</option>
            </select>
          </label>
        </div>

        <div className="menu-panel">
          <div className="menu-panel-header">
            <div>
              <p className="menu-panel-label">Filtro atual</p>
              <h3>{activeCategoryName}</h3>
            </div>
            <span className="menu-panel-count">
              {filteredProducts.length} opcoes encontradas
            </span>
          </div>

          {filteredProducts.length ? (
            <div className="menu-grid">
              {filteredProducts.map((product) => (
                <article
                  className={`menu-card${product.isPromo ? ' menu-card--promo' : ''}${product.categoryIds.includes('dia-das-maes') ? ' menu-card--mothers-day' : ''}${product.isAvailable ? '' : ' menu-card--unavailable'}`}
                  key={product.id}
                >
                  <div className="menu-card-imageWrap">
                    {product.imageSrc ? (
                      <img
                        src={product.imageSrc}
                        alt={product.name}
                        className="menu-card-image"
                      />
                    ) : (
                      <div className="menu-card-placeholder">
                        imagem do produto
                      </div>
                    )}

                    {product.isAvailable ? (
                      product.isPromo ? (
                        <span className="menu-card-badge">Promocional</span>
                      ) : null
                    ) : (
                      <span className="menu-card-badge menu-card-badge--unavailable">
                        Indisponivel
                      </span>
                    )}
                  </div>

                  <div className="menu-card-content">
                    <div className="menu-card-topline">
                      <span className="menu-card-category">
                        {product.primaryCategoryLabel}
                      </span>
                    </div>

                    <strong className="menu-card-price">
                      {formatStartingPrice(product.basePrice)}
                    </strong>
                    <h4>{product.name}</h4>
                    <p>{truncateDescription(product.description)}</p>

                    <div className="menu-card-actions">
                      <button
                        type="button"
                        className={`menu-card-cartButton${product.isAvailable ? '' : ' is-disabled'}`}
                        onClick={() => setConfirmingProductId(product.id)}
                        disabled={!product.isAvailable}
                      >
                        {product.isAvailable
                          ? 'Adicionar ao carrinho'
                          : 'Item indisponivel'}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="menu-emptyState">
              <strong>Nenhum produto encontrado.</strong>
              <p>
                Ajuste os filtros para ver outras combinacoes de categoria,
                disponibilidade e produto.
              </p>
            </div>
          )}
        </div>
      </div>

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
                    : 'Entrega pronta'}
                </span>
                <span className="menu-card-fulfillmentText">
                  {confirmingProduct.fulfillmentType === 'encomenda'
                    ? 'feito sob pedido com prazo combinado'
                    : 'preparo agil para entrega no momento do pedido'}
                </span>
              </div>

              {confirmingProduct.options?.length ? (
                <div className="menu-card-optionGroup">
                  <label className="menu-card-field">
                    <span>Tamanho</span>
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
                          {option.label} • {formatCurrency(option.price)}
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
                    Confirmar e adicionar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
