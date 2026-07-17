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
        throw new Error(data.error ?? 'Nao foi possivel cadastrar agora.')
      }
      saveGuestCustomer({ name, phone })
      localStorage.setItem(guestPromptKey, 'true')
      setUser(data.user)
      setPromptOpen(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Nao foi possivel cadastrar agora.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function loginWithPhone(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: loginPhone }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error ?? 'Nao foi possivel entrar com este telefone.')
      }
      saveGuestCustomer({ name: data.user.name, phone: loginPhone })
      localStorage.setItem(guestPromptKey, 'true')
      setUser(data.user)
      setLoginOpen(false)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Nao foi possivel entrar.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {children(user, setUser, () => setLoginOpen(true))}

      {!loading && !user && promptOpen ? (
        <div className="customer-guestOverlay">
          <button
            type="button"
            className="customer-guestBackdrop"
            aria-label="Ver cardapio"
            onClick={closePrompt}
          />
          <section
            className="customer-guestModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-title"
          >
            <span className="customer-authEyebrow">Bem-vindo</span>
            <h2 id="guest-title">Antes de comecar</h2>
            <p>Informe nome e WhatsApp agora, ou veja o cardapio e preencha ao finalizar.</p>
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
            <button type="button" className="customer-authTextButton" onClick={closePrompt}>
              Ver cardapio
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
            onClick={() => setLoginOpen(false)}
          />
          <section
            className="customer-guestModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
          >
            <span className="customer-authEyebrow">Entrar</span>
            <h2 id="login-title">Use seu telefone</h2>
            <p>
              Informe seu WhatsApp. Se for seu primeiro acesso, seu cadastro
              será criado automaticamente.
            </p>
            <form onSubmit={loginWithPhone}>
              <label>
                WhatsApp
                <input
                  value={loginPhone}
                  onChange={(event) => setLoginPhone(formatPhone(event.target.value))}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="(75) 99999-9999"
                  autoFocus
                />
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
            {error ? <p className="customer-authError">{error}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  )
}
