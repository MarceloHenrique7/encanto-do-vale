import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'node:crypto'

const cookieName = 'encanto_manager'
const sessionDurationInSeconds = 60 * 60 * 12

function secrets() {
  return {
    password: String(process.env.ADMIN_PASSWORD ?? ''),
    sessionSecret: String(process.env.SESSION_SECRET ?? ''),
  }
}

function safeEqual(first, second) {
  const firstHash = createHash('sha256').update(first).digest()
  const secondHash = createHash('sha256').update(second).digest()
  return timingSafeEqual(firstHash, secondHash)
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function parseCookies(request) {
  return String(request.headers.cookie ?? '')
    .split(';')
    .map((cookie) => cookie.trim().split('='))
    .reduce((cookies, [name, ...value]) => {
      if (name) cookies[name] = decodeURIComponent(value.join('='))
      return cookies
    }, {})
}

export function isAdminConfigured() {
  const { password, sessionSecret } = secrets()
  return password.length >= 8 && sessionSecret.length >= 24
}

export function authenticatePassword(password) {
  const configuredPassword = secrets().password
  return Boolean(configuredPassword) && safeEqual(String(password), configuredPassword)
}

export function createAdminSession(response) {
  const { sessionSecret } = secrets()
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationInSeconds
  const payload = Buffer.from(JSON.stringify({ expiresAt })).toString('base64url')
  const token = `${payload}.${signature(payload, sessionSecret)}`

  response.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionDurationInSeconds * 1000,
    path: '/',
  })
}

export function clearAdminSession(response) {
  response.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

export function hasValidAdminSession(request) {
  const { sessionSecret } = secrets()
  const token = parseCookies(request)[cookieName]
  if (!sessionSecret || !token) return false

  const [payload, receivedSignature] = token.split('.')
  if (!payload || !receivedSignature) return false
  const expectedSignature = signature(payload, sessionSecret)
  if (!safeEqual(receivedSignature, expectedSignature)) return false

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return Number(session.expiresAt) > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}

export function requireAdmin(request, response, next) {
  if (!hasValidAdminSession(request)) {
    return response.status(401).json({ error: 'Acesso do gestor não autorizado.' })
  }
  return next()
}
