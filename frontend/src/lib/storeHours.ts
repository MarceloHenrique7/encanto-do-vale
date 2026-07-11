import { storeConfig } from '@/config/store'

function minutesFromTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function formatRange(open: string, close: string) {
  return `${open.replace(':00', 'h')} as ${close.replace(':00', 'h')}`
}

export function getStoreHoursStatus(now = new Date()) {
  const today = now.getDay()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const todayHours = storeConfig.weeklyHours.find((entry) => entry.day === today)

  if (
    todayHours &&
    !todayHours.closed &&
    currentMinutes >= minutesFromTime(todayHours.open) &&
    currentMinutes < minutesFromTime(todayHours.close)
  ) {
    return {
      isOpen: true,
      label: 'Aceitando pedidos',
      detail: `Hoje: ${formatRange(todayHours.open, todayHours.close)}`,
    }
  }

  const nextOpen = [...storeConfig.weeklyHours, ...storeConfig.weeklyHours]
    .slice(today + 1, today + 8)
    .find((entry) => !entry.closed)

  return {
    isOpen: false,
    label: 'Loja fechada agora',
    detail: nextOpen
      ? `Proximo horario: ${nextOpen.label}, ${formatRange(nextOpen.open, nextOpen.close)}`
      : 'Sem horario disponivel',
  }
}
