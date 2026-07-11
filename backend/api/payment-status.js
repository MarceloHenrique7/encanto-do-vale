import {
  getAccessToken,
  normalizeHeader,
  setCorsHeaders,
} from './_payment-utils.js'

export default async function handler(request, response) {
  setCorsHeaders(request, response)

  if (request.method === 'OPTIONS') {
    return response.status(204).json({})
  }

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET')
    return response.status(405).json({ error: 'Metodo nao permitido.' })
  }

  const accessToken = getAccessToken()
  const paymentId = normalizeHeader(request.query?.id)

  if (!accessToken) {
    return response.status(500).json({
      error: 'Configure MERCADO_PAGO_ACCESS_TOKEN para consultar pagamento.',
    })
  }

  if (!paymentId || !/^\d{1,30}$/.test(String(paymentId))) {
    return response.status(400).json({ error: 'Informe o id do pagamento.' })
  }

  const mercadoPagoResponse = await fetch(
    `https://api.mercadopago.com/v1/payments/${paymentId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  )

  const data = await mercadoPagoResponse.json().catch(() => ({}))

  if (!mercadoPagoResponse.ok) {
    return response.status(mercadoPagoResponse.status).json({
      error: 'Nao foi possivel consultar o pagamento.',
      details: data,
    })
  }

  return response.status(200).json({
    paymentId: data.id,
    status: data.status,
    statusDetail: data.status_detail,
    externalReference: data.external_reference,
  })
}
