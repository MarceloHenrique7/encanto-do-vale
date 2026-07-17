const timeZone = 'America/Bahia'
import { getCachedStoreSettings } from './store-settings.js'
const weekDayMap = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

function minutesFromTime(value) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function formatRange(open, close) {
  return `${open.replace(':00', 'h')} as ${close.replace(':00', 'h')}`
}

function zonedNow(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type) => parts.find((part) => part.type === type)?.value ?? ''

  return {
    day: weekDayMap[value('weekday')] ?? now.getDay(),
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  }
}

export function getStoreHoursStatus(now = new Date()) {
  if (process.env.STORE_FORCE_OPEN === 'true') {
    return { isOpen: true, label: 'Aceitando pedidos', detail: 'Loja aberta para pedidos' }
  }
  const weeklyHours = getCachedStoreSettings().weeklyHours
  const { day: today, minutes: currentMinutes } = zonedNow(now)
  const todayHours = weeklyHours.find((entry) => entry.day === today)

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

  const schedule = [...weeklyHours, ...weeklyHours]
  const todayIndex = schedule.findIndex((entry) => entry.day === today)
  const nextOpen =
    todayHours &&
    !todayHours.closed &&
    currentMinutes < minutesFromTime(todayHours.open)
      ? todayHours
      : schedule
          .slice(todayIndex + 1, todayIndex + 8)
          .find((entry) => !entry.closed)

  return {
    isOpen: false,
    label: 'Loja fechada agora',
    detail: nextOpen
      ? `Proximo horario: ${nextOpen.label}, ${formatRange(nextOpen.open, nextOpen.close)}`
      : 'Sem horario disponivel',
  }
}
