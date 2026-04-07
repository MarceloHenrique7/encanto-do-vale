import { useMemo, useState } from 'react'

import { categories, products } from '@/data/landing'
import type { Product } from '@/types/landing'

type CardapioProps = {
  onAddToCart: (productId: string, optionId: string | undefined, quantity: number) => void
}

export default function Cardapio({ onAddToCart }: CardapioProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('destaques')
  const [selectedFulfillment, setSelectedFulfillment] = useState<
    'todos' | 'encomenda' | 'entrega-pronta'
  >('encomenda')
  const [selectedProductId, setSelectedProductId] = useState('todos')
  const [selectedPriceOrder, setSelectedPriceOrder] = useState<
    'default' | 'asc' | 'desc'
  >('asc')
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string>>({})
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)
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

  const categoryProducts = useMemo(() => {
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

  return (
    <section  id="cardapio" className="section menu-section">
      <div className="menu-shell" id="encomende">
        <div className="menu-header">
          <div className="section-heading menu-heading">
            <p className="section-label">Cardapio</p>
            <h2>Encontre o doce ideal com um filtro rapido, intuitivo e pronto para pedido.</h2>
            <p className="menu-description">
              Selecione a categoria, refine por atendimento e escolha um
              produto especifico se quiser ir direto ao ponto.
            </p>
          </div>
        </div>

        <div className="menu-filters">
          <label className="menu-filterField">
            <span>Categoria</span>
            <select
              value={selectedCategoryId}
              onChange={(event) => {
                setSelectedCategoryId(event.target.value)
                setSelectedProductId('todos')
              }}
            >
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
              <h3>{activeCategory?.name}</h3>
            </div>
            <span className="menu-panel-count">
              {filteredProducts.length} opcoes encontradas
            </span>
          </div>

          {filteredProducts.length ? (
            <div className="menu-grid">
              {filteredProducts.map((product) => (
                <article
                  className={`menu-card${product.isPromo ? ' menu-card--promo' : ''}${product.isAvailable ? '' : ' menu-card--unavailable'}`}
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
                      <strong className="menu-card-price">
                        {formatCurrency(getUnitPrice(product))}
                      </strong>
                    </div>

                    <h4>{product.name}</h4>
                    <p>{product.description}</p>

                    {product.options?.length ? (
                      <div className="menu-card-optionGroup">
                        <label className="menu-card-field">
                          <span>Tamanho</span>
                          <select
                            value={getSelectedOption(product)?.id ?? ''}
                            onChange={(event) =>
                              setSelectedOptionIds((current) => ({
                                ...current,
                                [product.id]: event.target.value,
                              }))
                            }
                          >
                            {product.options.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label} • {formatCurrency(option.price)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}

                    <div className="menu-card-fulfillment">
                      <span
                        className={`menu-card-fulfillmentBadge menu-card-fulfillmentBadge--${product.fulfillmentType}`}
                      >
                        {product.fulfillmentType === 'encomenda'
                          ? 'Encomenda'
                          : 'Entrega pronta'}
                      </span>
                      <span className="menu-card-fulfillmentText">
                        {product.fulfillmentType === 'encomenda'
                          ? 'feito sob pedido com prazo combinado'
                          : 'preparo agil para entrega no momento do pedido'}
                      </span>
                      {product.options?.length ? (
                        <span className="menu-card-fulfillmentText">
                          {getSelectedOption(product)?.quantityLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="menu-card-actions">
                      <label className="menu-card-field">
                        <span>Quantidade</span>
                        <select
                          value={String(getSelectedQuantity(product.id))}
                          onChange={(event) =>
                            setSelectedQuantities((current) => ({
                              ...current,
                              [product.id]: Number(event.target.value),
                            }))
                          }
                          disabled={!product.isAvailable}
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
                        Total: {formatCurrency(getUnitPrice(product) * getSelectedQuantity(product.id))}
                      </p>

                      <button
                        type="button"
                        className={`menu-card-cartButton${product.isAvailable ? '' : ' is-disabled'}`}
                        onClick={() =>
                          onAddToCart(
                            product.id,
                            getSelectedOption(product)?.id,
                            getSelectedQuantity(product.id),
                          )
                        }
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
    </section>
  )
}
