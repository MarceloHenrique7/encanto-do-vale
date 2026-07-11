import { sanitizeText } from '../api/_payment-utils.js'
import {
  clearCustomerSession,
  createCustomerSession,
  getCustomerFromRequest,
  hashPassword,
  maskPhone,
  normalizeBrazilianPhone,
  publicUser,
  verifyPassword,
} from '../services/customer-auth.js'
import {
  checkPhoneVerification,
  isPhoneProviderConfigured,
  sendPhoneVerification,
} from '../services/phone-verification.js'
import {
  findUserByPhone,
  updateUser,
  upsertPendingUser,
  upsertVerifiedUser,
} from '../services/user-store.js'

const sendAttempts = new Map()

function canSendCode(phone) {
  const now = Date.now()
  const entry = sendAttempts.get(phone)
  if (!entry || entry.resetAt <= now) {
    sendAttempts.set(phone, { count: 1, resetAt: now + 10 * 60_000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count += 1
  return true
}

function sessionIsConfigured() {
  return String(process.env.SESSION_SECRET ?? '').length >= 24
}

export async function getCustomerSession(request, response) {
  const user = await getCustomerFromRequest(request)
  return response.json({
    authenticated: Boolean(user),
    user: user ? publicUser(user) : null,
    phone_provider_configured: isPhoneProviderConfigured(),
  })
}

export async function postRequestCode(request, response) {
  if (!sessionIsConfigured()) {
    return response.status(503).json({
      error: 'A autenticação ainda não foi configurada no servidor.',
    })
  }

  const phone = normalizeBrazilianPhone(request.body?.phone)
  const purpose = request.body?.purpose === 'login' ? 'login' : 'register'
  const channel = request.body?.channel === 'whatsapp' ? 'whatsapp' : 'sms'
  if (!phone) {
    return response.status(400).json({ error: 'Informe um celular válido com DDD.' })
  }

  let user = await findUserByPhone(phone)
  if (purpose === 'register') {
    const name = sanitizeText(request.body?.name, 80)
    if (name.length < 2) {
      return response.status(400).json({ error: 'Informe seu nome completo.' })
    }
    if (user?.verified) {
      return response.status(409).json({
        error: 'Este celular já está cadastrado. Entre usando seu número.',
      })
    }
    user = await upsertPendingUser({ name, phone })
  } else if (!user?.verified) {
    return response.status(404).json({
      error: 'Celular não cadastrado. Crie sua conta primeiro.',
    })
  }

  if (!canSendCode(phone)) {
    return response.status(429).json({
      error: 'Muitos códigos solicitados. Aguarde alguns minutos.',
    })
  }

  try {
    const result = await sendPhoneVerification(phone, channel)
    return response.json({
      sent: true,
      masked_phone: maskPhone(phone),
      channel,
      development_code: result.developmentCode,
    })
  } catch (error) {
    console.error('Falha ao enviar código de acesso', {
      channel,
      code: error?.code,
      status: error?.status,
      message: error?.message,
    })
    const configurationError =
      error?.message === 'PHONE_PROVIDER_CONFIGURATION_INVALID'
        ? 'A Twilio está incompleta: configure um serviço Verify com SID iniciado por VA e reinicie o servidor.'
        : error?.message === 'PHONE_PROVIDER_NOT_CONFIGURED'
          ? 'Configure o provedor de SMS/WhatsApp antes de publicar.'
          : null
    const providerError =
      channel === 'whatsapp' && error?.code
        ? `A Twilio recusou o envio pelo WhatsApp (erro ${error.code}). Confira o WhatsApp Sender do serviço Verify.`
        : 'Não foi possível enviar o código. Confira o número e tente novamente.'
    return response.status(502).json({
      error: configurationError ?? providerError,
    })
  }
}

export async function postVerifyCode(request, response) {
  const phone = normalizeBrazilianPhone(request.body?.phone)
  const code = String(request.body?.code ?? '').replace(/\D/g, '').slice(0, 10)
  if (!phone || code.length < 4) {
    return response.status(400).json({ error: 'Código de verificação inválido.' })
  }

  const user = await findUserByPhone(phone)
  if (!user) {
    return response.status(404).json({ error: 'Cadastro não encontrado.' })
  }

  try {
    const approved = await checkPhoneVerification(phone, code)
    if (!approved) {
      return response.status(401).json({ error: 'Código incorreto ou expirado.' })
    }
  } catch (error) {
    console.error('Falha ao validar código de acesso', { message: error?.message })
    return response.status(502).json({
      error: 'Não foi possível validar o código agora.',
    })
  }

  const verifiedUser = await updateUser(user.id, {
    verified: true,
    verified_at: new Date().toISOString(),
  })
  createCustomerSession(response, verifiedUser.id)
  return response.json({ authenticated: true, user: publicUser(verifiedUser) })
}

export async function postPasswordLogin(request, response) {
  const phone = normalizeBrazilianPhone(request.body?.phone)
  const password = String(request.body?.password ?? '')
  const user = phone ? await findUserByPhone(phone) : null
  if (
    !user?.verified ||
    !(await verifyPassword(password, user.password_hash, user.password_salt))
  ) {
    return response.status(401).json({ error: 'Celular ou senha incorretos.' })
  }

  createCustomerSession(response, user.id)
  return response.json({ authenticated: true, user: publicUser(user) })
}

export async function postPhoneLogin(request, response) {
  const phone = normalizeBrazilianPhone(request.body?.phone)
  const user = phone ? await findUserByPhone(phone) : null
  if (!user?.verified) {
    return response.status(404).json({ error: 'Celular nao cadastrado.' })
  }

  createCustomerSession(response, user.id)
  return response.json({ authenticated: true, user: publicUser(user) })
}

export async function postGuestAccess(request, response) {
  if (!sessionIsConfigured()) {
    return response.status(503).json({
      error: 'A autenticacao ainda nao foi configurada no servidor.',
    })
  }

  const name = sanitizeText(request.body?.name, 80)
  const phone = normalizeBrazilianPhone(request.body?.phone)
  if (name.length < 2) {
    return response.status(400).json({ error: 'Informe seu nome.' })
  }
  if (!phone) {
    return response.status(400).json({ error: 'Informe um WhatsApp valido com DDD.' })
  }

  const user = await upsertVerifiedUser({ name, phone })
  createCustomerSession(response, user.id)
  return response.json({ authenticated: true, user: publicUser(user) })
}

export async function patchCustomerProfile(request, response) {
  const user = request.customerUser
  const name = sanitizeText(request.body?.name ?? user.name, 80)
  const newPassword = String(request.body?.new_password ?? '')
  const currentPassword = String(request.body?.current_password ?? '')

  if (name.length < 2) {
    return response.status(400).json({ error: 'Informe um nome válido.' })
  }

  const changes = { name }
  if (newPassword) {
    if (newPassword.length < 8) {
      return response.status(400).json({
        error: 'A nova senha precisa ter pelo menos 8 caracteres.',
      })
    }
    if (
      user.password_hash &&
      !(await verifyPassword(
        currentPassword,
        user.password_hash,
        user.password_salt,
      ))
    ) {
      return response.status(401).json({ error: 'Senha atual incorreta.' })
    }
    const password = await hashPassword(newPassword)
    changes.password_hash = password.hash
    changes.password_salt = password.salt
  }

  const updated = await updateUser(user.id, changes)
  return response.json({ user: publicUser(updated) })
}

export function postCustomerLogout(_request, response) {
  clearCustomerSession(response)
  return response.json({ authenticated: false })
}
