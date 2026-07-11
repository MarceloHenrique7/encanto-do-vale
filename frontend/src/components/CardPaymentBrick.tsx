import { useEffect, useRef, useState } from 'react'

type CardPaymentBrickProps = {
  amount: number
  orderPayload: unknown
  onPaymentResult: (result: {
    paymentId?: string
    status?: string
    statusDetail?: string
    error?: string
  }) => void
}

type MercadoPagoInstance = {
  bricks: () => {
    create: (
      type: 'cardPayment',
      containerId: string,
      settings: unknown,
    ) => Promise<{ unmount: () => void }>
  }
}

type CardPaymentFormData = {
  token?: string
  installments?: number
  payment_method_id?: string
  issuer_id?: string
  payer?: {
    email?: string
    identification?: {
      type?: string
      number?: string
    }
  }
}

declare global {
  interface Window {
    MercadoPago?: new (
      publicKey: string,
      options?: { locale?: string },
    ) => MercadoPagoInstance
  }
}

const sdkSrc = 'https://sdk.mercadopago.com/js/v2'

function loadMercadoPagoSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.MercadoPago) {
      resolve()
      return
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${sdkSrc}"]`,
    )

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = sdkSrc
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Falha ao carregar Mercado Pago.'))
    document.body.appendChild(script)
  })
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Nao foi possivel iniciar o checkout do Mercado Pago agora.'
}

export default function CardPaymentBrick({
  amount,
  orderPayload,
  onPaymentResult,
}: CardPaymentBrickProps) {
  const controllerRef = useRef<{ unmount: () => void } | null>(null)
  const orderPayloadRef = useRef(orderPayload)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  )
  const [checkoutError, setCheckoutError] = useState('')
  const publicKey = import.meta.env.VITE_MERCADO_PAGO_PUBLIC_KEY
  const isUsingLiveCredentialsLocally =
    import.meta.env.DEV && publicKey?.startsWith('APP_USR-')
  const cardPaymentApiUrl =
    import.meta.env.VITE_CARD_PAYMENT_API_URL || '/api/process-card-payment'

  orderPayloadRef.current = orderPayload

  useEffect(() => {
    let isMounted = true

    async function renderBrick() {
      if (
        !publicKey ||
        /sua|seu|your|troque|exemplo/i.test(publicKey) ||
        amount <= 0
      ) {
        return
      }

      setStatus('loading')
      setCheckoutError('')

      try {
        await loadMercadoPagoSdk()

        if (!isMounted || !window.MercadoPago) {
          return
        }

        const mercadopago = new window.MercadoPago(publicKey, {
          locale: 'pt-BR',
        })
        const bricksBuilder = mercadopago.bricks()

        controllerRef.current = await bricksBuilder.create(
          'cardPayment',
          'cardPaymentBrick_container',
          {
            initialization: {
              amount,
            },
            callbacks: {
              onReady: () => {
                if (isMounted) {
                  setStatus('ready')
                }
              },
              onSubmit: async (formData: CardPaymentFormData) => {
                const paymentResponse = await fetch(cardPaymentApiUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    ...formData,
                    order: orderPayloadRef.current,
                  }),
                })
                const paymentData = await paymentResponse.json().catch(() => ({}))

                if (!paymentResponse.ok) {
                  const message =
                    paymentData.error ?? 'Não foi possível processar o cartão.'
                  onPaymentResult({ error: message })
                  throw new Error(message)
                }

                onPaymentResult(paymentData)
              },
              onError: (error: unknown) => {
                console.error('Erro no Checkout Brick', error)
                const message = normalizeErrorMessage(error)
                setCheckoutError(message)
                setStatus('error')
                onPaymentResult({ error: message })
              },
            },
          },
        )
      } catch (error) {
        console.error('Erro ao iniciar Mercado Pago Brick', error)

        if (isMounted) {
          setStatus('error')
          setCheckoutError(normalizeErrorMessage(error))
          onPaymentResult({ error: normalizeErrorMessage(error) })
        }
      }
    }

    renderBrick()

    return () => {
      isMounted = false
      controllerRef.current?.unmount()
      controllerRef.current = null
    }
  }, [amount, cardPaymentApiUrl, onPaymentResult, publicKey])

  if (!publicKey || /sua|seu|your|troque|exemplo/i.test(publicKey)) {
    return (
      <p className="cart-checkoutError">
        Configure uma Public Key real da sua aplicação Mercado Pago. O valor do
        arquivo de exemplo não processa pagamentos.
      </p>
    )
  }

  return (
    <div className="cart-cardBrick">
      {isUsingLiveCredentialsLocally ? (
        <p className="cart-checkoutWarning">
          Ambiente local com credenciais de produção. Para usar cartões de
          teste, troque a Public Key e o Access Token pelo par de teste da mesma
          aplicação.
        </p>
      ) : null}
      {status === 'loading' ? (
        <p className="cart-checkoutHint">Carregando checkout do Mercado Pago...</p>
      ) : null}
      {status === 'error' ? (
        <p className="cart-checkoutError">
          {checkoutError || 'Nao foi possivel carregar o checkout agora.'}
        </p>
      ) : null}
      <div id="cardPaymentBrick_container" />
    </div>
  )
}
