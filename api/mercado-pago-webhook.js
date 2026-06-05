async function fetchMercadoPagoPayment(paymentId, accessToken) {
  const mercadoPagoResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  if (!mercadoPagoResponse.ok) {
    return null
  }

  return mercadoPagoResponse.json()
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Metodo nao permitido.' })
  }

  const sellerAccessToken =
    process.env.MERCADO_PAGO_SELLER_ACCESS_TOKEN?.trim()
  const accessToken =
    sellerAccessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim()

  const event = request.body ?? {}
  const paymentId =
    event?.data?.id ??
    event?.id ??
    request.query?.['data.id'] ??
    request.query?.id

  if (accessToken && paymentId) {
    try {
      const payment = await fetchMercadoPagoPayment(paymentId, accessToken)

      console.log('Mercado Pago payment notification', {
        paymentId,
        status: payment?.status,
        statusDetail: payment?.status_detail,
        externalReference: payment?.external_reference,
      })
    } catch (error) {
      console.error('Erro ao consultar pagamento Mercado Pago', error)
    }
  } else {
    console.log('Mercado Pago notification received', event)
  }

  return response.status(200).json({ received: true })
}
