const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function formatCurrency(value: number) {
  return brlFormatter.format(value)
}

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export function truncateText(value: string, maxLength = 88) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength).trimEnd()}…`
}
