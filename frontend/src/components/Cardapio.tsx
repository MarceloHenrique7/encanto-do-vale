import { useMemo, useState } from 'react'

import { useCatalogCategories } from '@/features/catalog/catalogStore'
import { formatCurrency, normalizeSearchText, truncateText } from '@/lib/formatters'
import type { Product } from '@/domain/catalog'
import { FiPlus, FiSearch, FiSliders } from 'react-icons/fi'

type CardapioProps = {
  products: Product[]
  onAddToCart: (
    productId: string,
    optionId: string | undefined,
    quantity: number,
    extras?: string[],
  ) => boolean
}

type FulfillmentFilter = 'todos' | 'encomenda' | 'entrega-pronta'
type PriceOrder = 'default' | 'asc' | 'desc'

const fulfillmentLabels: Record<FulfillmentFilter, string> = {
  todos: 'Todos',
  encomenda: 'Encomenda',
  'entrega-pronta': 'Pronta entrega',
}

export default function Cardapio({ products, onAddToCart }: CardapioProps) {
  const categories = useCatalogCategories()
  const [selectedCategoryId, setSelectedCategoryId] = useState('todos')
  const [selectedFulfillment, setSelectedFulfillment] =
    useState<FulfillmentFilter>('todos')
  const [selectedPriceOrder, setSelectedPriceOrder] =
    useState<PriceOrder>('default')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOptionIds, setSelectedOptionIds] = useState<Record<string, string>>({})
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({})
  const [confirmingProductId, setConfirmingProductId] = useState<string | null>(null)
  const [selectedExtras, setSelectedExtras] = useState<Record<string, string[]>>({})
  const [cartError, setCartError] = useState('')

  function formatProductPrice(product: Product): string {
    if (product.fulfillmentType === 'entrega-pronta') {
      return formatCurrency(product.basePrice)
    }
    return `A partir de ${formatCurrency(product.basePrice)}`
  }

  function getSelectedOption(product: Product) {
    if (!product.options?.length) {
      return undefined
    }

    const selectedOptionId = selectedOptionIds[product.id]

    if (selectedOptionId) {
      return product.options.find((option) => option.id === selectedOptionId)
    }

    return undefined
  }

  function getUnitPrice(product: Product) {
    const base = getSelectedOption(product)?.price ?? product.basePrice
    const extras = selectedExtras[product.id] ?? []
    const extrasSum = (product.extras ?? []).reduce((sum, extra) => {
      return sum + (extras.includes(extra.id) ? extra.price : 0)
    }, 0)

    return base + extrasSum
  }

  function getProductExtraGroups(product: Product) {
    const extras = product.extras ?? []
    const groupedIds = new Set(
      (product.extraGroups ?? []).flatMap((group) => group.extraIds),
    )
    const groups = (product.extraGroups ?? []).flatMap((group) => {
      const groupExtras = group.extraIds.flatMap((extraId) => {
        const extra = extras.find((entry) => entry.id === extraId)
        return extra ? [extra] : []
      })
      if (!groupExtras.length) return []
      return [{ ...group, extras: groupExtras }]
    })
    const ungroupedExtras = extras.filter((extra) => !groupedIds.has(extra.id))

    if (ungroupedExtras.length) {
      groups.push({
        id: 'outros-adicionais',
        label: groups.length ? 'Outros adicionais' : 'Adicionais',
        minSelections: 0,
        maxSelections: ungroupedExtras.length,
        extraIds: ungroupedExtras.map((extra) => extra.id),
        extras: ungroupedExtras,
      })
    }
    return groups
  }

  function toggleExtra(
    product: Product,
    groupId: string,
    extraId: string,
    checked: boolean,
  ) {
    const group = getProductExtraGroups(product).find((entry) => entry.id === groupId)
    if (!group) return

    setSelectedExtras((current) => {
      const currentList = current[product.id] ?? []
      const selectedInGroup = currentList.filter((id) => group.extraIds.includes(id))
      let next = currentList

      if (!checked) {
        next = currentList.filter((id) => id !== extraId)
      } else if (group.maxSelections === 1) {
        next = [...currentList.filter((id) => !group.extraIds.includes(id)), extraId]
      } else if (selectedInGroup.length < group.maxSelections) {
        next = [...currentList, extraId]
      }

      return { ...current, [product.id]: [...new Set(next)] }
    })
    setCartError('')
  }

  function getExtraGroupError(product: Product) {
    const selected = selectedExtras[product.id] ?? []
    for (const group of getProductExtraGroups(product)) {
      const count = selected.filter((id) => group.extraIds.includes(id)).length
      if (count > group.maxSelections) {
        return `Escolha no máximo ${group.maxSelections} item(ns) em “${group.label}”.`
      }
    }
    return ''
  }

  function getSelectedQuantity(productId: string) {
    return selectedQuantities[productId] ?? 1
  }

  function closeConfirmation() {
    setConfirmingProductId(null)
    setCartError('')
  }

  function resetFilters() {
    setSelectedCategoryId('todos')
    setSelectedFulfillment('todos')
    setSelectedPriceOrder('default')
    setSearchTerm('')
  }

  const readyProductsCount = useMemo(
    () =>
      products.filter((product) => product.fulfillmentType === 'entrega-pronta')
        .length,
    [products],
  )

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
    const normalizedSearch = normalizeSearchText(searchTerm.trim())

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
        normalizeSearchText(
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
    selectedCategoryId === 'todos' ? 'Cardápio completo' : activeCategory?.name
  const confirmingProduct =
    products.find((product) => product.id === confirmingProductId) ?? null
  const confirmingExtraGroups = useMemo(
    () => (confirmingProduct ? getProductExtraGroups(confirmingProduct) : []),
    [confirmingProduct],
  )

  return (
    <main id="cardapio" className="menu-app">
      <section className="menu-workspace" id="encomende">
        <div className="catalog-heading">
          <div><span>Nosso cardápio</span><h1>O que você deseja pedir?</h1></div>
          <p>{products.length} opções entre doces, bolos, sobremesas e presentes.</p>
        </div>
        <div className="menu-toolbar">
          <label className="menu-search">
            <span>Buscar no cardápio</span>
            <div className="menu-search-control"><FiSearch /><input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="O que você deseja hoje?"
                type="search"
              /></div>
          </label>

          <div className="menu-selects">
            <span className="filter-label"><FiSliders /> Filtros</span>
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
              <span>Preço</span>
              <select
                value={selectedPriceOrder}
                onChange={(event) =>
                  setSelectedPriceOrder(event.target.value as PriceOrder)
                }
              >
                <option value="default">Padrão</option>
                <option value="asc">Menor preço</option>
                <option value="desc">Maior preço</option>
              </select>
            </label>
          </div>
        </div>

        <div className="menu-categoryRail" aria-label="Categorias do cardápio">
          <button
            type="button"
            className={`menu-categoryChip${selectedCategoryId === 'todos' ? ' is-active' : ''}`}
            aria-pressed={selectedCategoryId === 'todos'}
            onClick={() => setSelectedCategoryId('todos')}
          >
            <span className="menu-categoryName">Todos</span>
            <small>{products.length}</small>
          </button>

          {categories.map((category) => (
            <button
              type="button"
              className={`menu-categoryChip${selectedCategoryId === category.id ? ' is-active' : ''}`}
              aria-pressed={selectedCategoryId === category.id}
              key={category.id}
              onClick={() => setSelectedCategoryId(category.id)}
            >
              <span className="menu-categoryName">{category.name}</span>
              <small>{categoryCounts[category.id] ?? 0}</small>
            </button>
          ))}
        </div>

        <div className="menu-resultsHeader">
          <div>
            <span className="menu-panel-label">Categoria</span>
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
                        loading="lazy"
                        decoding="async"
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
                      {truncateText(product.description)}
                    </span>
                    {product.options?.length || product.extras?.length ? (
                      <span className="menu-card-capabilities">
                        {product.options?.length ? (
                          <span>{product.options.length} {product.options.length === 1 ? 'opção' : 'opções'}</span>
                        ) : null}
                        {product.extras?.length ? (
                          <span>{product.extras.length} {product.extras.length === 1 ? 'complemento' : 'complementos'}</span>
                        ) : null}
                      </span>
                    ) : null}
                    <span className="menu-card-footer">
                      <span>
                        <small>{product.fulfillmentType === 'encomenda' ? 'A partir de' : 'Preço'}</small>
                        <strong className="menu-card-price">
                          {formatCurrency(product.basePrice)}
                        </strong>
                      </span>
                      <span className="menu-card-actionLabel">
                        {product.options?.length || product.extras?.length ? 'Personalizar' : 'Ver item'}
                      </span>
                      <span
                        className={`menu-card-quickAction${product.isAvailable ? '' : ' is-disabled'}`}
                      >
                        {product.isAvailable ? <FiPlus /> : 'Indisponível'}
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
                  decoding="async"
                />
              ) : (
                <div className="product-confirmation-placeholder">
                  imagem do produto
                </div>
              )}
            </div>

            <div className="product-confirmation-content">
              <div className="product-confirmation-header">
                <span className="product-confirmation-panelTitle">
                  Detalhes do produto
                </span>
                <button
                  type="button"
                  className="product-confirmation-close"
                  onClick={closeConfirmation}
                  aria-label="Fechar detalhes"
                >
                  ×
                </button>
              </div>

              <span className="menu-card-category">
                {confirmingProduct.primaryCategoryLabel}
              </span>
              <h3 id="product-confirmation-title">{confirmingProduct.name}</h3>
              <strong className="product-confirmation-price">
                {formatProductPrice(confirmingProduct)}
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
                    <span>Opcao *</span>
                    <select
                      value={getSelectedOption(confirmingProduct)?.id ?? ''}
                      onChange={(event) =>
                        setSelectedOptionIds((current) => ({
                          ...current,
                          [confirmingProduct.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecione uma opção</option>
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

              {confirmingProduct.extras?.length ? (
                <div className="menu-extraGroups">
                  {confirmingExtraGroups.map((group) => {
                    const selected = selectedExtras[confirmingProduct.id] ?? []
                    const selectedCount = selected.filter((id) =>
                      group.extraIds.includes(id),
                    ).length
                    const limitReached = selectedCount >= group.maxSelections
                    return (
                      <section className="menu-extraGroup" key={group.id}>
                        <header>
                          <div>
                            <strong>{group.label}</strong>
                            <small>
                              Opcional
                            </small>
                          </div>
                          <span>
                            {group.maxSelections === 1
                              ? 'Escolha 1'
                              : `Escolha até ${group.maxSelections}`}
                          </span>
                        </header>
                        <div className="menu-card-extras">
                          {group.extras.map((extra) => {
                            const isSelected = selected.includes(extra.id)
                            return (
                              <label key={extra.id} className={`menu-extra${isSelected ? ' is-selected' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={!isSelected && limitReached && group.maxSelections > 1}
                                  onChange={(event) =>
                                    toggleExtra(
                                      confirmingProduct,
                                      group.id,
                                      extra.id,
                                      event.target.checked,
                                    )
                                  }
                                />
                                <span>{extra.label}</span>
                                <strong>+ {formatCurrency(extra.price)}</strong>
                              </label>
                            )
                          })}
                        </div>
                        <small className="menu-extraGroupCount">
                          {selectedCount} de {group.maxSelections} selecionado(s)
                        </small>
                      </section>
                    )
                  })}
                </div>
              ) : null}

              <div className="product-confirmation-actions">
                <div className="product-quantityRow">
                  <span>Quantidade</span>
                  <div className="product-quantityStepper">
                    <button
                      type="button"
                      disabled={getSelectedQuantity(confirmingProduct.id) <= 1}
                      onClick={() =>
                        setSelectedQuantities((current) => ({
                          ...current,
                          [confirmingProduct.id]: Math.max(
                            1,
                            getSelectedQuantity(confirmingProduct.id) - 1,
                          ),
                        }))
                      }
                    >
                      −
                    </button>
                    <strong>{getSelectedQuantity(confirmingProduct.id)}</strong>
                    <button
                      type="button"
                      disabled={getSelectedQuantity(confirmingProduct.id) >= 10}
                      onClick={() =>
                        setSelectedQuantities((current) => ({
                          ...current,
                          [confirmingProduct.id]: Math.min(
                            10,
                            getSelectedQuantity(confirmingProduct.id) + 1,
                          ),
                        }))
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

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
                      const groupError = getExtraGroupError(confirmingProduct)
                      if (groupError) {
                        setCartError(groupError)
                        return
                      }
                      const wasAdded = onAddToCart(
                        confirmingProduct.id,
                        getSelectedOption(confirmingProduct)?.id,
                        getSelectedQuantity(confirmingProduct.id),
                        selectedExtras[confirmingProduct.id] ?? [],
                      )

                      if (!wasAdded) {
                        setCartError(
                          confirmingProduct.options?.length &&
                            !getSelectedOption(confirmingProduct)
                            ? 'Selecione uma opção antes de adicionar.'
                            : 'Não foi possível adicionar este item. Atualize a página e tente novamente.',
                        )
                        return
                      }

                      setSelectedExtras((current) => ({
                        ...current,
                        [confirmingProduct.id]: [],
                      }))
                      closeConfirmation()
                    }}
                    disabled={!confirmingProduct.isAvailable}
                  >
                    {confirmingProduct.isAvailable
                      ? 'Adicionar ao carrinho'
                      : 'Item indisponivel'}
                  </button>
                </div>
                {cartError ? (
                  <p className="menu-card-addError" role="alert">
                    {cartError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
