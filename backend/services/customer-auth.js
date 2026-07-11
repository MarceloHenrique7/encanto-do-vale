import {
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'

import { findUserById } from './user-store.js'

const scrypt = promisify(scryptCallback)
const cookieName = 'encanto_customer'
const sessionDurationInSeconds = 60 * 60 * 24 * 30

function sessionSecret() {
  return String(process.env.SESSION_SECRET ?? '')
}

function signature(payload) {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
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

export function normalizeBrazilianPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  const national = digits.startsWith('55') ? digits.slice(2) : digits
  if (!/^[1-9]{2}9?\d{8}$/.test(national)) return null
  return `+55${national}`
}

export function maskPhone(phone) {
  return `(**) *****-${phone.slice(-4)}`
}

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(String(password), salt, 64)
  return { hash: Buffer.from(derived).toString('hex'), salt }
}

export async function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false
  const candidate = await hashPassword(password, salt)
  const expectedBuffer = Buffer.from(hash, 'hex')
  const candidateBuffer = Buffer.from(candidate.hash, 'hex')
  return (
    expectedBuffer.length === candidateBuffer.length &&
    timingSafeEqual(expectedBuffer, candidateBuffer)
  )
}

export function createCustomerSession(response, userId) {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionDurationInSeconds
  const payload = Buffer.from(JSON.stringify({ userId, expiresAt })).toString(
    'base64url',
  )
  response.cookie(cookieName, `${payload}.${signature(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: sessionDurationInSeconds * 1000,
    path: '/',
  })
}

export function clearCustomerSession(response) {
  response.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

export async function getCustomerFromRequest(request) {
  const secret = sessionSecret()
  const token = parseCookies(request)[cookieName]
  if (secret.length < 24 || !token) return null
  const [payload, receivedSignature] = token.split('.')
  if (!payload || !receivedSignature) return null

  const expected = signature(payload)
  const receivedBuffer = Buffer.from(receivedSignature)
  const expectedBuffer = Buffer.from(expected)
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return null
  }

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (Number(session.expiresAt) <= Math.floor(Date.now() / 1000)) return null
    const user = await findUserById(session.userId)
    return user?.verified ? user : null
  } catch {
    return null
  }
}

export async function requireCustomer(request, response, next) {
  const user = await getCustomerFromRequest(request)
  if (!user) {
    return response.status(401).json({ error: 'Faça login para continuar.' })
  }
  request.customerUser = user
  return next()
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    phone: user.phone,
    has_password: Boolean(user.password_hash),
  }
}
