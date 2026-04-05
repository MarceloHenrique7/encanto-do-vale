import { useMemo, useState } from 'react'

import { categories, products } from '@/data/landing'

type CardapioProps = {
  onAddToCart: (productId: string) => void
}

export default function Cardapio({ onAddToCart }: CardapioProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('destaques')
  const [selectedFulfillment, setSelectedFulfillment] = useState<
    'todos' | 'encomenda' | 'entrega-pronta'
  >('todos')
  const [selectedProductId, setSelectedProductId] = useState('todos')
  const [selectedPriceOrder, setSelectedPriceOrder] = useState<
    'default' | 'asc' | 'desc'
  >('default')

  function parsePrice(price: string) {
    return Number(price.replace(/[^\d,]/g, '').replace(',', '.'))
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
        (first, second) => parsePrice(first.price) - parsePrice(second.price),
      )
    }

    if (selectedPriceOrder === 'desc') {
      return [...filtered].sort(
        (first, second) => parsePrice(second.price) - parsePrice(first.price),
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
    <section className="section menu-section" id="cardapio">
      <div className="menu-shell" id="encomende">
        <div className="menu-header">
          <div className="section-heading menu-heading">
            <p className="section-label">Cardapio</p>
            <h2>Encontre o doce ideal com um filtro rapido, intuitivo e pronto para pedido.</h2>
            <p className="menu-description">
              Selecione a categoria, refine por disponibilidade e escolha um
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
            <span>Disponibilidade</span>
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
                  className={`menu-card${product.isPromo ? ' menu-card--promo' : ''}`}
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

                    {product.isPromo ? (
                      <span className="menu-card-badge">Promocional</span>
                    ) : null}
                  </div>

                  <div className="menu-card-content">
                    <div className="menu-card-topline">
                      <span className="menu-card-category">
                        {product.primaryCategoryLabel}
                      </span>
                      <strong className="menu-card-price">{product.price}</strong>
                    </div>

                    <h4>{product.name}</h4>
                    <p>{product.description}</p>

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
                    </div>

                    <div className="menu-card-actions">
                      <button
                        type="button"
                        className="menu-card-cartButton"
                        onClick={() => onAddToCart(product.id)}
                      >
                        Adicionar ao carrinho
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
