export type Category = {
  id: string
  name: string
  shortLabel: string
}

export type ProductOption = {
  id: string
  label: string
  quantityLabel?: string
  price: number
}

export type ProductExtra = {
  id: string
  label: string
  price: number
}

export type ProductExtraGroup = {
  id: string
  label: string
  minSelections: number
  maxSelections: number
  extraIds: string[]
}

export type Product = {
  id: string
  name: string
  description: string
  price: string
  basePrice: number
  imageSrc: string
  fulfillmentType: 'encomenda' | 'entrega-pronta'
  isAvailable: boolean
  isFeatured: boolean
  isPromo: boolean
  primaryCategoryLabel: string
  categoryIds: string[]
  options?: ProductOption[]
  extras?: ProductExtra[]
  extraGroups?: ProductExtraGroup[]
}

export type CartItem = {
  productId: string
  optionId?: string
  quantity: number
  extras?: string[]
}
