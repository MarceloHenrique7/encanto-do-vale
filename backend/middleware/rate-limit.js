function clientKey(request) {
  return request.ip || request.socket?.remoteAddress || 'unknown'
}

export function createRateLimiter({
  windowMs,
  max,
  message = 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  key = clientKey,
}) {
  const entries = new Map()
  let requestsSinceCleanup = 0

  return function rateLimit(request, response, next) {
    const now = Date.now()
    const identifier = String(key(request))
    const current = entries.get(identifier)
    const entry =
      !current || current.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : current

    entry.count += 1
    entries.set(identifier, entry)

    requestsSinceCleanup += 1
    if (requestsSinceCleanup >= 500) {
      requestsSinceCleanup = 0
      for (const [storedKey, storedEntry] of entries) {
        if (storedEntry.resetAt <= now) entries.delete(storedKey)
      }
    }

    response.setHeader(
      'RateLimit-Policy',
      `${max};w=${Math.ceil(windowMs / 1000)}`,
    )
    response.setHeader('RateLimit-Limit', String(max))
    response.setHeader(
      'RateLimit-Remaining',
      String(Math.max(0, max - entry.count)),
    )
    response.setHeader(
      'RateLimit-Reset',
      String(Math.ceil(entry.resetAt / 1000)),
    )

    if (entry.count > max) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))),
      )
      response.setHeader('Cache-Control', 'no-store')
      return response.status(429).json({ error: message })
    }

    return next()
  }
}
