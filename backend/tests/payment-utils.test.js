import assert from 'node:assert/strict'
import test from 'node:test'

import {
  fromCents,
  getAccessToken,
  getMercadoPagoError,
  hasValidExtraGroupSelections,
  normalizeOrder,
  toCents,
  toMoney,
} from '../api/_payment-utils.js'

const validCustomer = {
  name: 'Maria',
  phone: '(87) 99999-9999',
  email: 'maria@example.com',
  document: '12345678909',
  address: 'Rua das Flores, 10',
  neighborhood: 'Centro',
}

test('normaliza dinheiro sem erro de ponto flutuante', () => {
  assert.equal(toCents(0.1 + 0.2), 30)
  assert.equal(fromCents(12990), 129.9)
  assert.equal(toMoney('14.999'), 15)
})

test('não aceita credenciais de exemplo como token de pagamento', () => {
  const previousToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-seu-access-token'

  assert.equal(getAccessToken(), undefined)

  if (previousToken === undefined) {
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN
  } else {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = previousToken
  }
})

test('apresenta erro seguro retornado pelo Mercado Pago', () => {
  const message = getMercadoPagoError(
    {
      message: 'invalid_parameter',
      cause: [{ description: 'payer identification is required' }],
    },
    'Pagamento recusado.',
  )

  assert.equal(
    message,
    'Pagamento recusado. — invalid_parameter — payer identification is required',
  )
})

test('traduz mistura de credencial de produção com teste', () => {
  assert.equal(
    getMercadoPagoError(
      { message: 'Unauthorized use of live credentials' },
      'Pagamento recusado.',
    ),
    'Credenciais de produção não autorizadas para este teste. Use a Public Key e o Access Token de teste da mesma aplicação.',
  )
})

test('calcula subtotal e entrega por bairro no servidor', () => {
  const order = normalizeOrder({
    deliveryMethod: 'delivery',
    deliveryFee: 0.01,
    customer: validCustomer,
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme',
        productId: 'bolo-de-pote-kitkat-supreme',
        quantity: 3,
        unitPrice: 14.99,
      },
    ],
  })

  assert.equal(order.error, undefined)
  assert.equal(order.subtotal, 44.97)
  assert.equal(order.deliveryFee, 11.49)
  assert.equal(order.total, 56.46)
})

test('rejeita cliente inválido e carrinho sem itens válidos', () => {
  assert.equal(
    normalizeOrder({ customer: {}, items: [] }).error,
    'Informe o nome do cliente.',
  )

  assert.equal(
    normalizeOrder({
      customer: validCustomer,
      items: [{ id: 'x', productId: 'produto-inexistente', quantity: 1 }],
    }).error,
    'Carrinho vazio ou invalido.',
  )
})

test('limita quantidades e normaliza método de entrega desconhecido', () => {
  const order = normalizeOrder({
    deliveryMethod: 'carrier-pigeon',
    customer: validCustomer,
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme',
        productId: 'bolo-de-pote-kitkat-supreme',
        quantity: 500,
        unitPrice: 14.99,
      },
    ],
  })

  assert.equal(order.deliveryMethod, 'pickup')
  assert.equal(order.checkoutItems[0].quantity, 99)
  assert.equal(order.deliveryFee, 0)
})

test('valida opções e adicionais pelo catálogo publicado', () => {
  const missingOption = normalizeOrder({
    customer: validCustomer,
    items: [
      {
        id: 'brigadeiros-caixas',
        productId: 'brigadeiros-caixas',
        quantity: 1,
      },
    ],
  })
  assert.equal(missingOption.error, 'Carrinho vazio ou invalido.')

  const withExtra = normalizeOrder({
    customer: validCustomer,
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme:leite-condensado',
        productId: 'bolo-de-pote-kitkat-supreme',
        extraIds: ['leite-condensado'],
        quantity: 2,
        unitPrice: 16.99,
      },
    ],
  })
  assert.equal(withExtra.checkoutItems[0].unitPrice, 16.99)
  assert.equal(withExtra.total, 33.98)
})

test('mantém grupos opcionais e valida o máximo de complementos', () => {
  const product = {
    extraGroups: [{
      id: 'frutas',
      label: 'Escolha suas frutas',
      minSelections: 1,
      maxSelections: 2,
      extraIds: ['morango', 'banana', 'uva'],
    }],
  }

  assert.equal(hasValidExtraGroupSelections(product, []), true)
  assert.equal(hasValidExtraGroupSelections(product, ['morango']), true)
  assert.equal(
    hasValidExtraGroupSelections(product, ['morango', 'banana', 'uva']),
    false,
  )
})

test('bloqueia preço local diferente do catálogo publicado', () => {
  const order = normalizeOrder({
    customer: validCustomer,
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme',
        productId: 'bolo-de-pote-kitkat-supreme',
        quantity: 1,
        unitPrice: 1.99,
      },
    ],
  })

  assert.equal(
    order.error,
    'O preço do carrinho está desatualizado. Recarregue o catálogo antes de pagar.',
  )
})
