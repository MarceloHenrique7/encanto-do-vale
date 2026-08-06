import { FormEvent, ReactNode, useEffect, useState } from 'react'

export type CustomerUser = {
  id: string
  name: string
  phone: string
  has_password: boolean
}

type CustomerAuthGateProps = {
  children: (
    user: CustomerUser | null,
    updateUser: (user: CustomerUser | null) => void,
    openLogin: () => void,
  ) => ReactNode
}

const guestPromptKey = 'encanto_guest_prompt_seen'
const guestDraftKey = 'encanto_guest_customer'

export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function loadGuestCustomer() {
  try {
    const parsed = JSON.parse(localStorage.getItem(guestDraftKey) ?? '{}')
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
    }
  } catch {
    return { name: '', phone: '' }
  }
}

export function saveGuestCustomer(customer: { name: string; phone: string }) {
  localStorage.setItem(
    guestDraftKey,
    JSON.stringify({ name: customer.name, phone: customer.phone }),
  )
}

export default function CustomerAuthGate({ children }: CustomerAuthGateProps) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<CustomerUser | null>(null)
  const [promptOpen, setPromptOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loginPhone, setLoginPhone] = useState('')
  const [loginMode, setLoginMode] = useState<'code' | 'password'>('code')
  const [loginStage, setLoginStage] = useState<'credentials' | 'verification'>(
    'credentials',
  )
  const [loginChannel, setLoginChannel] = useState<'sms' | 'whatsapp'>('sms')
  const [loginCode, setLoginCode] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [developmentCode, setDevelopmentCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((data) => {
        setUser(data.authenticated ? data.user : null)
        if (!data.authenticated && !localStorage.getItem(guestPromptKey)) {
          const draft = loadGuestCustomer()
          setName(draft.name)
          setPhone(draft.phone)
          setPromptOpen(true)
        }
      })
      .catch(() => {
        if (!localStorage.getItem(guestPromptKey)) setPromptOpen(true)
      })
      .finally(() => setLoading(false))
  }, [])

  function closePrompt() {
    localStorage.setItem(guestPromptKey, 'true')
    setPromptOpen(false)
    setError('')
  }

  function openLogin() {
    const draft = loadGuestCustomer()
    setLoginPhone((current) => current || draft.phone)
    setLoginStage('credentials')
    setLoginCode('')
    setLoginPassword('')
    setDevelopmentCode('')
    setError('')
    setLoginOpen(true)
  }

  function closeLogin() {
    setLoginOpen(false)
    setLoginStage('credentials')
    setLoginCode('')
    setLoginPassword('')
    setDevelopmentCode('')
    setError('')
  }

  function completeLogin(data: { user: CustomerUser }) {
    saveGuestCustomer({ name: data.user.name, phone: loginPhone })
    localStorage.setItem(guestPromptKey, 'true')
    setUser(data.user)
    closeLogin()
  }

  async function saveGuest(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 409) {
          setLoginPhone(phone)
          setPromptOpen(false)
          setLoginOpen(true)
          setLoginStage('credentials')
        }
        throw new Error(data.error ?? 'Não foi possível cadastrar agora.')
      }
      saveGuestCustomer({ name, phone })
      localStorage.setItem(guestPromptKey, 'true')
      setUser(data.user)
      setPromptOpen(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível cadastrar agora.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function requestLoginCode(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: loginPhone,
          purpose: 'login',
          channel: loginChannel,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? 'Não foi possível enviar o código.')
      }
      setDevelopmentCode(data.development_code ?? '')
      setLoginStage('verification')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível enviar o código.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function verifyLoginCode(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone, code: loginCode }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? 'Código incorreto ou expirado.')
      }
      completeLogin(data)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível validar o código.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function loginWithPassword(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: loginPhone,
          password: loginPassword,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? 'Celular ou senha incorretos.')
      }
      completeLogin(data)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível entrar.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {children(user, setUser, openLogin)}

      {!loading && !user && promptOpen ? (
        <div className="customer-guestOverlay">
          <button
            type="button"
            className="customer-guestBackdrop"
            aria-label="Ver cardápio"
            onClick={closePrompt}
          />
          <section
            className="customer-guestModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-title"
          >
            <span className="customer-authEyebrow">Bem-vindo</span>
            <h2 id="guest-title">Antes de começar</h2>
            <p>
              Informe nome e WhatsApp agora, ou veja o cardápio e preencha ao
              finalizar.
            </p>
            <form onSubmit={saveGuest}>
              <label>
                Nome
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder="Seu nome"
                  autoFocus
                />
              </label>
              <label>
                WhatsApp
                <input
                  value={phone}
                  onChange={(event) => setPhone(formatPhone(event.target.value))}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(75) 99999-9999"
                />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Entrando...' : 'Continuar'}
              </button>
            </form>
            {error ? <p className="customer-authError">{error}</p> : null}
            <button
              type="button"
              className="customer-authTextButton"
              onClick={closePrompt}
            >
              Ver cardápio
            </button>
          </section>
        </div>
      ) : null}

      {!loading && !user && loginOpen ? (
        <div className="customer-guestOverlay">
          <button
            type="button"
            className="customer-guestBackdrop"
            aria-label="Fechar login"
            onClick={closeLogin}
          />
          <section
            className="customer-guestModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
          >
            <span className="customer-authEyebrow">Entrar</span>
            <h2 id="login-title">
              {loginStage === 'verification'
                ? 'Digite o código'
                : 'Acesse sua conta'}
            </h2>
            <p>
              {loginStage === 'verification'
                ? `Enviamos um código de segurança por ${
                    loginChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'
                  }.`
                : 'Use um código de segurança ou a senha cadastrada no seu perfil.'}
            </p>

            {loginStage === 'credentials' ? (
              <>
                <div className="customer-authTabs">
                  <button
                    type="button"
                    className={loginMode === 'code' ? 'is-active' : ''}
                    onClick={() => {
                      setLoginMode('code')
                      setError('')
                    }}
                  >
                    Código
                  </button>
                  <button
                    type="button"
                    className={loginMode === 'password' ? 'is-active' : ''}
                    onClick={() => {
                      setLoginMode('password')
                      setError('')
                    }}
                  >
                    Senha
                  </button>
                </div>
                {loginMode === 'code' ? (
                  <form onSubmit={requestLoginCode}>
                    <label>
                      WhatsApp
                      <input
                        value={loginPhone}
                        onChange={(event) =>
                          setLoginPhone(formatPhone(event.target.value))
                        }
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(75) 99999-9999"
                        autoFocus
                      />
                    </label>
                    <fieldset className="customer-channelChoice">
                      <legend>Receber código por</legend>
                      <button
                        type="button"
                        className={loginChannel === 'sms' ? 'is-active' : ''}
                        onClick={() => setLoginChannel('sms')}
                      >
                        SMS
                      </button>
                      <button
                        type="button"
                        className={
                          loginChannel === 'whatsapp' ? 'is-active' : ''
                        }
                        onClick={() => setLoginChannel('whatsapp')}
                      >
                        WhatsApp
                      </button>
                    </fieldset>
                    <button type="submit" disabled={submitting}>
                      {submitting ? 'Enviando...' : 'Enviar código'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={loginWithPassword}>
                    <label>
                      WhatsApp
                      <input
                        value={loginPhone}
                        onChange={(event) =>
                          setLoginPhone(formatPhone(event.target.value))
                        }
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="(75) 99999-9999"
                        autoFocus
                      />
                    </label>
                    <label>
                      Senha
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(event) =>
                          setLoginPassword(event.target.value)
                        }
                        autoComplete="current-password"
                      />
                    </label>
                    <button type="submit" disabled={submitting}>
                      {submitting ? 'Entrando...' : 'Entrar'}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <>
                {developmentCode ? (
                  <p className="customer-developmentCode">
                    Ambiente local: código {developmentCode}
                  </p>
                ) : null}
                <form onSubmit={verifyLoginCode}>
                  <label>
                    Código de segurança
                    <input
                      className="customer-codeInput"
                      value={loginCode}
                      onChange={(event) =>
                        setLoginCode(
                          event.target.value.replace(/\D/g, '').slice(0, 10),
                        )
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                    />
                  </label>
                  <button type="submit" disabled={submitting}>
                    {submitting ? 'Validando...' : 'Confirmar código'}
                  </button>
                </form>
                <button
                  type="button"
                  className="customer-authTextButton"
                  onClick={() => {
                    setLoginStage('credentials')
                    setLoginCode('')
                    setDevelopmentCode('')
                    setError('')
                  }}
                >
                  Voltar e reenviar
                </button>
              </>
            )}
            {error ? <p className="customer-authError">{error}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  )
}
