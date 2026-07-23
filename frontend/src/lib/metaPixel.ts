type MetaPixelArguments = unknown[]

type MetaPixelFunction = ((...args: MetaPixelArguments) => void) & {
  callMethod?: (...args: MetaPixelArguments) => void
  queue: MetaPixelArguments[]
  loaded: boolean
  version: string
}

declare global {
  interface Window {
    _fbq?: MetaPixelFunction
    fbq?: MetaPixelFunction
  }
}

type MetaEventParameters = Record<string, unknown>

const pixelId = import.meta.env.VITE_META_PIXEL_ID?.trim() ?? ''
let initialized = false

function isPublicStorePage() {
  return !['/admin', '/gestor'].includes(window.location.pathname)
}

export function initializeMetaPixel() {
  if (initialized || !/^\d+$/.test(pixelId) || !isPublicStorePage()) {
    return false
  }

  initialized = true

  if (!window.fbq) {
    const fbq = ((...args: MetaPixelArguments) => {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue.push(args)
    }) as MetaPixelFunction

    fbq.queue = []
    fbq.loaded = true
    fbq.version = '2.0'
    window.fbq = fbq
    window._fbq = fbq

    const script = document.createElement('script')
    script.async = true
    script.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(script)
  }

  window.fbq('init', pixelId)
  window.fbq('track', 'PageView')
  return true
}

export function trackMetaEvent(
  eventName: string,
  parameters: MetaEventParameters = {},
  eventId?: string,
) {
  initializeMetaPixel()
  if (!window.fbq || !initialized) return false

  window.fbq(
    'track',
    eventName,
    parameters,
    eventId ? { eventID: eventId } : undefined,
  )
  return true
}

export function trackMetaPurchaseOnce(
  orderId: string,
  parameters: MetaEventParameters,
) {
  if (!/^\d+$/.test(pixelId) || !orderId) return false

  const storageKey = `meta-purchase:${pixelId}:${orderId}`
  try {
    if (window.localStorage.getItem(storageKey)) return false
  } catch {
    // O navegador pode bloquear o armazenamento; o evento ainda pode ser enviado.
  }

  if (!trackMetaEvent('Purchase', parameters, orderId)) return false

  try {
    window.localStorage.setItem(storageKey, new Date().toISOString())
  } catch {
    // Sem armazenamento, o eventID ainda permite deduplicacao pela Meta.
  }

  return true
}
