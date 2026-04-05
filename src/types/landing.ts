export type Category = {
  id: string
  name: string
  shortLabel: string
}

export type Product = {
  id: string
  name: string
  description: string
  price: string
  imageSrc: string
  fulfillmentType: 'encomenda' | 'entrega-pronta'
  isFeatured: boolean
  isPromo: boolean
  primaryCategoryLabel: string
  categoryIds: string[]
}

export type CartItem = {
  productId: string
  quantity: number
}

export type Stat = {
  value: string
  label: string
}
