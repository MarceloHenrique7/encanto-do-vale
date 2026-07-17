import { useCallback, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import { initMercadoPago, Payment } from '@mercadopago/sdk-react'

declare const __MERCADO_PAGO_PUBLIC_KEY__: string

type PaymentResult = {
  payment_id?: string | number
  status?: string
  status_detail?: string
  order_id: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
      ticket_url?: string
    }
  } | null
}

type PaymentBrickProps = {
  amount: number
  orderId: string
  customer: {
    email: string
  }
  onResult: (result: PaymentResult) => void
  onError: (message: string) => void
  onPaymentStart: () => void
}

type PaymentSubmitData = Parameters<
  NonNullable<ComponentProps<typeof Payment>['onSubmit']>
>[0]

let initializedPublicKey = ''

function developmentLog(...values: unknown[]) {
  if (import.meta.env.DEV) {
    console.error(...values)
  }
}

export default function PaymentBrick({
  amount,
  orderId,
  customer,
  onResult,
  onError,
  onPaymentStart,
}: PaymentBrickProps) {
  const [isReady, setIsReady] = useState(false)
  const publicKey = __MERCADO_PAGO_PUBLIC_KEY__?.trim()

  if (publicKey && initializedPublicKey !== publicKey) {
    initMercadoPago(publicKey, { locale: 'pt-BR' })
    initializedPublicKey = publicKey
  }

  const initialization = useMemo(
    () => ({
      amount,
      payer: { email: customer.email },
    }),
    [amount, customer.email],
  )
  const customization = useMemo(
    () => ({
      paymentMethods: {
        creditCard: 'all' as const,
        debitCard: 'all' as const,
        bankTransfer: 'all' as const,
        maxInstallments: 12,
      },
      visual: {
        style: {
          theme: 'default' as const,
        },
      },
    }),
    [],
  )

  const handleSubmit = useCallback(
    async (brickData: PaymentSubmitData) => {
      onPaymentStart()
      const paymentResponse = await fetch('/api/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          selectedPaymentMethod: brickData.selectedPaymentMethod,
          formData: brickData.formData,
        }),
      })
      const data = await paymentResponse.json().catch(() => ({}))

      if (!paymentResponse.ok) {
        const message =
          data.error ?? 'Não foi possível concluir o pagamento. Tente novamente.'
        onError(message)
        throw new Error(message)
      }

      onResult(data)
      return data
    },
    [onError, onPaymentStart, onResult, orderId],
  )

  const handleBrickError = useCallback(
    (error: unknown) => {
      developmentLog('Erro no Payment Brick', error)
      onError('O Mercado Pago não pôde carregar. Atualize a página e tente novamente.')
    },
    [onError],
  )

  if (!publicKey) {
    return (
      <p className="cart-checkoutError">
        Configure MERCADO_PAGO_PUBLIC_KEY no arquivo .env.
      </p>
    )
  }

  return (
    <div className="cart-cardBrick">
      {!isReady ? (
        <p className="cart-checkoutHint">Carregando pagamento seguro…</p>
      ) : null}
      <Payment
        initialization={initialization}
        customization={customization}
        locale="pt-BR"
        onReady={() => setIsReady(true)}
        onSubmit={handleSubmit}
        onError={handleBrickError}
      />
    </div>
  )
}
