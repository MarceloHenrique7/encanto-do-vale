export type Category = {
  id: string
  name: string
  shortLabel: string
}

export type ShowcaseSlide = {
  id: string
  imageSrc: string
}

export type ProductOption = {
  id: string
  label: string
  quantityLabel?: string
  price: number
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
}

export type CartItem = {
  productId: string
  optionId?: string
  quantity: number
}

export type Stat = {
  value: string
  label: string
}
