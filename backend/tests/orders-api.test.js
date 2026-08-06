import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

process.env.STORE_FORCE_OPEN = 'true'
import request from 'supertest'

import { createApp } from '../app.js'
import {
  isUsingTestCredentials,
  mapPaymentStatus,
} from '../services/mercado-pago.js'
import {
  createOrder,
  findOrder,
  incrementPaymentAttempts,
  resetOrdersForTests,
} from '../services/order-store.js'
import { updateOrder } from '../services/order-store.js'
import { resetUsersForTests } from '../services/user-store.js'
import { resetAddressesForTests } from '../services/address-store.js'
import {
  paymentBodyFrom,
  paymentNotificationUrl,
} from '../controllers/checkout.js'

const ordersFile = path.join(
  os.tmpdir(),
  `encanto-orders-test-${process.pid}.json`,
)
const usersFile = path.join(
  os.tmpdir(),
  `encanto-users-test-${process.pid}.json`,
)
const loyaltyFile = path.join(
  os.tmpdir(),
  `encanto-loyalty-orders-test-${process.pid}.json`,
)
const addressesFile = path.join(
  os.tmpdir(),
  `encanto-addresses-orders-test-${process.pid}.json`,
)
process.env.ORDERS_FILE = ordersFile
process.env.USERS_FILE = usersFile
process.env.LOYALTY_FILE = loyaltyFile
process.env.ADDRESSES_FILE = addressesFile
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.ADMIN_PASSWORD = 'senha-forte-de-teste'
process.env.SESSION_SECRET = 'segredo-de-sessao-com-mais-de-24-caracteres'

test.beforeEach(async () => {
  await resetOrdersForTests()
  await resetUsersForTests()
  await resetAddressesForTests()
})

test.after(async () => {
  await rm(ordersFile, { force: true })
  await rm(usersFile, { force: true })
  await rm(loyaltyFile, { force: true })
  await rm(addressesFile, { force: true })
})

async function authenticatedCustomer(app, suffix = '01') {
  const agent = request.agent(app)
  const phone = `(75) 99999-99${suffix}`
  const requestCode = await agent.post('/api/auth/request-code').send({
    purpose: 'register',
    name: 'Maria Cliente',
    phone,
    channel: 'sms',
  })
  assert.equal(requestCode.status, 200)
  assert.ok(requestCode.body.development_code)

  const verification = await agent.post('/api/auth/verify-code').send({
    phone,
    code: requestCode.body.development_code,
  })
  assert.equal(verification.status, 200)
  assert.match(verification.headers['set-cookie'][0], /Max-Age=86400/)
  return agent
}

test('cria e consulta pedido recalculando os valores no servidor', async () => {
  const app = createApp()
  const customer = await authenticatedCustomer(app, '01')
  const creation = await customer
    .post('/api/orders')
    .send({
      customer: {
        name: 'Maria',
        phone: '(75) 99999-9999',
        address: 'Rua das Flores',
        number: '10',
        neighborhood: 'Centro',
        complement: 'Casa',
      },
      delivery_method: 'delivery',
      items: [
        {
          id: 'bolo-de-pote-kitkat-supreme',
          name: 'Nome adulterado',
          quantity: 2,
          extraIds: ['leite-condensado'],
          unit_price: 16.99,
        },
      ],
      delivery_fee: 0.01,
      subtotal: 0.01,
      total: 0.02,
    })

  assert.equal(creation.status, 201)
  assert.equal(creation.body.total, 45.47)
  assert.match(creation.body.order_id, /^[0-9a-f-]{36}$/)

  const lookup = await customer.get(
    `/api/orders/${creation.body.order_id}`,
  )
  assert.equal(lookup.status, 200)
  assert.equal(lookup.body.status, 'pending')
  assert.equal(lookup.body.items[0].name, 'Bolo de Pote Kitkat Supreme')
  assert.match(lookup.body.items[0].image_src, /^https:\/\//)
  assert.deepEqual(lookup.body.items[0].extras, [
    {
      id: 'leite-condensado',
      name: 'Calda de leite condensado',
      price: 2,
    },
  ])
  assert.equal(lookup.body.subtotal, 33.98)
  assert.equal(lookup.body.delivery_fee, 11.49)
  assert.equal(lookup.body.neighborhood, 'Centro')
  assert.equal(lookup.body.distanceKm, 7)
  assert.equal(lookup.body.estimated_delivery_minutes, 60)
  const savedAddresses = await customer.get('/api/addresses')
  assert.equal(savedAddresses.status, 200)
  assert.equal(savedAddresses.body.addresses.length, 1)
  assert.equal(savedAddresses.body.addresses[0].address, 'Rua das Flores')
  assert.equal(savedAddresses.body.addresses[0].isDefault, true)
})

test('bloqueia pedido para bairro fora da área atendida', async () => {
  const app = createApp()
  const customer = await authenticatedCustomer(app, '05')
  const creation = await customer.post('/api/orders').send({
    customer: {
      name: 'Maria',
      phone: '75999999999',
      address: 'Rua Teste',
      number: '20',
      neighborhood: 'Bairro distante',
    },
    delivery_method: 'delivery',
    items: [{ id: 'bolo-de-pote-kitkat-supreme', quantity: 1, unit_price: 14.99 }],
  })

  assert.equal(creation.status, 400)
  assert.match(creation.body.error, /ainda não está disponível/)
})

test('exige os campos de entrega e bloqueia origem CORS diferente', async () => {
  const app = createApp()
  const customer = await authenticatedCustomer(app, '02')
  const invalidOrder = await customer
    .post('/api/orders')
    .send({
      customer: { name: 'Maria', phone: '75999999999' },
      delivery_method: 'delivery',
      items: [],
    })
  assert.equal(invalidOrder.status, 400)

  const forbiddenOrigin = await request(app)
    .get('/api/health')
    .set('Origin', 'https://site-malicioso.example')
  assert.equal(forbiddenOrigin.status, 403)
})

test('salva enderecos por cliente sem persistir dados de cartao', async () => {
  const app = createApp()
  const unauthenticated = await request(app).get('/api/addresses')
  assert.equal(unauthenticated.status, 401)

  const customer = await authenticatedCustomer(app, '15')
  const otherCustomer = await authenticatedCustomer(app, '16')
  const creation = await customer.post('/api/addresses').send({
    label: 'Casa',
    recipientName: 'Maria Cliente',
    phone: '(75) 99999-9915',
    address: 'Rua das Flores',
    number: '10',
    neighborhood: 'Centro',
    complement: 'Portao azul',
    card_number: '4111111111111111',
    security_code: '123',
  })

  assert.equal(creation.status, 201)
  assert.equal(creation.body.address.label, 'Casa')
  assert.equal('card_number' in creation.body.address, false)
  assert.equal('security_code' in creation.body.address, false)

  const duplicate = await customer.post('/api/addresses').send({
    label: 'Meu lar',
    recipientName: 'Maria Cliente',
    phone: '(75) 99999-9915',
    address: 'Rua das Flores',
    number: '10',
    neighborhood: 'Centro',
    complement: 'Portao azul',
  })
  assert.equal(duplicate.status, 201)
  assert.equal(duplicate.body.address.id, creation.body.address.id)

  const list = await customer.get('/api/addresses')
  assert.equal(list.status, 200)
  assert.equal(list.body.addresses.length, 1)
  assert.equal(list.body.addresses[0].label, 'Meu lar')

  const forbiddenDelete = await otherCustomer.delete(
    `/api/addresses/${creation.body.address.id}`,
  )
  assert.equal(forbiddenDelete.status, 404)

  const removal = await customer.delete(
    `/api/addresses/${creation.body.address.id}`,
  )
  assert.equal(removal.status, 204)
})

test('nao aceita pagamento em dinheiro na entrega', async () => {
  const app = createApp()
  const customer = await authenticatedCustomer(app, '03')
  const creation = await customer.post('/api/orders').send({
    customer: {
      name: 'Maria',
      phone: '75999999999',
      address: 'Rua Teste',
      number: '20',
      neighborhood: 'Centro',
    },
    delivery_method: 'delivery',
    payment_method: 'cash-delivery',
    items: [{ id: 'bolo-de-pote-kitkat-supreme', quantity: 2 }],
  })

  assert.equal(creation.status, 400)
  assert.match(creation.body.error, /nao esta disponivel/)
})

test('mapeia status do Mercado Pago para o pedido interno', () => {
  assert.equal(mapPaymentStatus('approved'), 'paid')
  assert.equal(mapPaymentStatus('pending'), 'waiting_payment')
  assert.equal(mapPaymentStatus('in_process'), 'waiting_payment')
  assert.equal(mapPaymentStatus('rejected'), 'failed')
  assert.equal(mapPaymentStatus('refunded'), 'failed')
})

test('nao envia notification_url local e aceita URL publica da Hostinger', () => {
  const previousBackendUrl = process.env.BACKEND_URL
  const previousPublicSiteUrl = process.env.PUBLIC_SITE_URL
  const previousRenderUrl = process.env.RENDER_EXTERNAL_URL
  const localRequest = {
    protocol: 'http',
    get: () => 'localhost:3000',
  }

  delete process.env.BACKEND_URL
  process.env.PUBLIC_SITE_URL = 'http://localhost:5173'
  delete process.env.RENDER_EXTERNAL_URL
  assert.equal(paymentNotificationUrl(localRequest), '')
  const order = {
    id: 'pedido-teste',
    total: 25,
    customer: { name: 'Cliente Teste', phone: '5575999999999' },
    delivery_method: 'delivery',
    items: [{ id: 'produto', name: 'Produto', quantity: 1, unit_price: 25 }],
  }
  const pixBody = paymentBodyFrom(
    order,
    { payment_method_id: 'pix', payer: { email: 'cliente@example.com' } },
    localRequest,
  )
  const cardBody = paymentBodyFrom(
    order,
    {
      payment_method_id: 'visa',
      token: 'token-de-cartao',
      installments: 1,
      payer: { email: 'cliente@example.com' },
    },
    localRequest,
  )
  assert.equal('notification_url' in pixBody, false)
  assert.equal('notification_url' in cardBody, false)

  process.env.BACKEND_URL = 'https://delivery.exemplo.com.br'
  assert.equal(
    paymentNotificationUrl(localRequest),
    'https://delivery.exemplo.com.br/api/webhooks/mercadopago',
  )

  if (previousBackendUrl === undefined) delete process.env.BACKEND_URL
  else process.env.BACKEND_URL = previousBackendUrl
  if (previousPublicSiteUrl === undefined) delete process.env.PUBLIC_SITE_URL
  else process.env.PUBLIC_SITE_URL = previousPublicSiteUrl
  if (previousRenderUrl === undefined) delete process.env.RENDER_EXTERNAL_URL
  else process.env.RENDER_EXTERNAL_URL = previousRenderUrl
})

test('permite avançar um pedido com pagamento na entrega', async () => {
  const app = createApp()
  const manager = request.agent(app)
  const login = await manager
    .post('/api/admin/login')
    .send({ password: 'senha-forte-de-teste' })
  assert.equal(login.status, 200)

  const order = {
    id: 'order-delivery-payment',
    user_id: 'guest-user',
    status: 'pending',
    restaurant_status: 'new',
    payment_status: null,
    payment_method: 'card-delivery',
    customer: {
      name: 'Joana',
      phone: '75999999999',
      address: 'Rua Teste',
      number: '31',
      neighborhood: 'Centro',
    },
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme',
        name: 'Bolo de Pote Kitkat Supreme',
        quantity: 1,
        unit_price: 14.99,
      },
    ],
    delivery_method: 'delivery',
    delivery_fee: 0,
    deliveryType: 'delivery',
    deliveryFee: 0,
    neighborhood: 'Centro',
    distanceKm: 0,
    subtotal: 14.99,
    total: 14.99,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  await createOrder(order)

  const update = await manager
    .patch(`/api/admin/orders/${order.id}/status`)
    .send({ status: 'preparing' })
  assert.equal(update.status, 200)
  assert.equal(update.body.order.restaurant_status, 'preparing')
})

test('protege o gestor e permite avançar um pedido pago', async () => {
  const app = createApp()
  const unauthenticated = await request(app).get('/api/admin/orders')
  assert.equal(unauthenticated.status, 401)
  const unauthenticatedCustomers = await request(app).get('/api/admin/customers')
  assert.equal(unauthenticatedCustomers.status, 401)

  const manager = request.agent(app)
  const login = await manager
    .post('/api/admin/login')
    .send({ password: 'senha-forte-de-teste' })
  assert.equal(login.status, 200)
  assert.match(login.headers['set-cookie'][0], /HttpOnly/)
  assert.match(login.headers['set-cookie'][0], /Max-Age=86400/)

  const customer = await authenticatedCustomer(app, '03')
  const creation = await customer
    .post('/api/orders')
    .send({
      customer: {
        name: 'Joao',
        phone: '75999999999',
        address: 'Rua Teste',
        number: '30',
        neighborhood: 'Centro',
      },
      delivery_method: 'delivery',
      items: [
        {
          id: 'bolo-de-pote-kitkat-supreme',
          quantity: 1,
          unit_price: 14.99,
        },
      ],
    })
  await updateOrder(creation.body.order_id, {
    status: 'paid',
    restaurant_status: 'new',
  })

  const orders = await manager.get('/api/admin/orders')
  assert.equal(orders.status, 200)
  assert.equal(orders.body.orders[0].restaurant_status, 'new')

  const update = await manager
    .patch(`/api/admin/orders/${creation.body.order_id}/status`)
    .send({ status: 'preparing' })
  assert.equal(update.status, 200)
  assert.equal(update.body.order.restaurant_status, 'preparing')

  await manager
    .patch(`/api/admin/orders/${creation.body.order_id}/status`)
    .send({ status: 'completed' })
  const customers = await manager.get('/api/admin/customers')
  assert.equal(customers.status, 200)
  const customerRecord = customers.body.customers.find(
    (item) => item.phone === '+5575999999903',
  )
  assert.equal(customerRecord.order_count, 1)
  assert.equal(customerRecord.orders[0].id, creation.body.order_id)
})

test('exige login no cardápio e permite criar senha no perfil', async () => {
  const app = createApp()
  const guest = request.agent(app)
  const guestOrder = await guest.post('/api/orders').send({
    customer: {
      name: 'Cliente Visitante',
      phone: '(75) 98888-7700',
      address: 'Rua Visitante',
      number: '40',
      neighborhood: 'Centro',
    },
    delivery_method: 'delivery',
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme',
        quantity: 1,
        unit_price: 14.99,
      },
    ],
  })
  assert.equal(guestOrder.status, 201)
  assert.equal(guestOrder.body.user.name, 'Cliente Visitante')
  assert.equal(guestOrder.body.user.has_password, false)

  const customer = await authenticatedCustomer(app, '04')
  const profile = await customer.patch('/api/auth/profile').send({
    name: 'Maria Atualizada',
    new_password: 'senha-segura-123',
  })
  assert.equal(profile.status, 200)
  assert.equal(profile.body.user.has_password, true)

  await customer.post('/api/auth/logout')
  const passwordLogin = await customer.post('/api/auth/login/password').send({
    phone: '(75) 99999-9904',
    password: 'senha-segura-123',
  })
  assert.equal(passwordLogin.status, 200)
})

test('lista no historico apenas pedidos finalizados do cliente logado', async () => {
  const app = createApp()
  const unauthenticated = await request(app).get('/api/orders')
  assert.equal(unauthenticated.status, 401)

  const customer = await authenticatedCustomer(app, '06')
  const otherCustomer = await authenticatedCustomer(app, '07')
  const orderPayload = {
    customer: {
      name: 'Maria',
      phone: '(75) 99999-9906',
      address: 'Rua das Flores',
      number: '10',
      neighborhood: 'Centro',
    },
    delivery_method: 'delivery',
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme',
        quantity: 1,
        unit_price: 14.99,
      },
    ],
  }

  const firstOrder = await customer.post('/api/orders').send(orderPayload)
  assert.equal(firstOrder.status, 201)
  const secondOrder = await customer.post('/api/orders').send(orderPayload)
  assert.equal(secondOrder.status, 201)
  await updateOrder(firstOrder.body.order_id, {
    status: 'paid',
    restaurant_status: 'completed',
  })

  const otherOrder = await otherCustomer.post('/api/orders').send({
    ...orderPayload,
    customer: {
      ...orderPayload.customer,
      phone: '(75) 99999-9907',
    },
  })
  assert.equal(otherOrder.status, 201)

  const history = await customer.get('/api/orders')
  assert.equal(history.status, 200)
  assert.equal(history.body.orders.length, 1)
  assert.equal(history.body.orders[0].order_id, firstOrder.body.order_id)
  assert.deepEqual(
    history.body.orders.map((order) => order.order_id).sort(),
    [firstOrder.body.order_id],
  )
  assert.equal(
    history.body.orders.some(
      (order) => order.order_id === otherOrder.body.order_id,
    ),
    false,
  )
})

test('expira pagamento online pendente antigo automaticamente', async () => {
  const app = createApp()
  const customer = await authenticatedCustomer(app, '08')
  const creation = await customer.post('/api/orders').send({
    customer: {
      name: 'Maria',
      phone: '(75) 99999-9908',
      address: 'Rua das Flores',
      number: '10',
      neighborhood: 'Centro',
    },
    delivery_method: 'delivery',
    payment_method: 'online',
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme',
        quantity: 1,
        unit_price: 14.99,
      },
    ],
  })
  assert.equal(creation.status, 201)

  await updateOrder(creation.body.order_id, {
    created_at: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    status: 'waiting_payment',
    restaurant_status: 'awaiting_payment',
    payment_status: 'pending',
  })

  const lookup = await customer.get(`/api/orders/${creation.body.order_id}`)
  assert.equal(lookup.status, 200)
  assert.equal(lookup.body.status, 'failed')
  assert.equal(lookup.body.restaurant_status, 'cancelled')
  assert.equal(lookup.body.payment_status, 'expired')
  assert.equal(lookup.body.status_detail, 'expired_pix')
})

test('cadastra visitante pelo primeiro acesso sem codigo sms', async () => {
  const app = createApp()
  const guest = request.agent(app)

  const access = await guest.post('/api/auth/guest').send({
    name: 'Cliente Primeiro Acesso',
    phone: '(87) 98802-8002',
  })
  assert.equal(access.status, 200)
  assert.equal(access.body.authenticated, true)
  assert.equal(access.body.user.name, 'Cliente Primeiro Acesso')
  assert.equal(access.body.user.phone, '+5587988028002')
  assert.equal(access.body.user.has_password, false)

  const session = await guest.get('/api/auth/session')
  assert.equal(session.status, 200)
  assert.equal(session.body.authenticated, true)
  assert.equal(session.body.user.phone, '+5587988028002')
})

test('exige codigo ou senha para acessar novamente um telefone cadastrado', async () => {
  const app = createApp()
  const firstAccess = request.agent(app)
  const returningCustomer = request.agent(app)

  const registration = await firstAccess.post('/api/auth/guest').send({
    name: 'Marcelo salvo anteriormente',
    phone: '(87) 98802-8111',
  })
  assert.equal(registration.status, 200)

  const repeatedGuest = await returningCustomer.post('/api/auth/guest').send({
    name: 'Outra pessoa',
    phone: '(87) 98802-8111',
  })
  assert.equal(repeatedGuest.status, 409)

  const removedUnsafeLogin = await returningCustomer
    .post('/api/auth/login/phone')
    .send({ phone: '(87) 98802-8111' })
  assert.equal(removedUnsafeLogin.status, 404)

  const requestCode = await returningCustomer
    .post('/api/auth/request-code')
    .send({
      purpose: 'login',
      phone: '(87) 98802-8111',
      channel: 'sms',
    })
  assert.equal(requestCode.status, 200)
  assert.ok(requestCode.body.development_code)

  const verification = await returningCustomer
    .post('/api/auth/verify-code')
    .send({
      phone: '(87) 98802-8111',
      code: requestCode.body.development_code,
    })
  assert.equal(verification.status, 200)
  assert.equal(verification.body.user.name, 'Marcelo salvo anteriormente')

  const session = await returningCustomer.get('/api/auth/session')
  assert.equal(session.status, 200)
  assert.equal(session.body.authenticated, true)
  assert.equal(session.body.user.phone, '+5587988028111')
})

test('limita tentativas repetidas nas rotas de autenticacao', async () => {
  const app = createApp()
  let response
  for (let attempt = 0; attempt < 31; attempt += 1) {
    response = await request(app).post('/api/auth/login/password').send({
      phone: '(87) 98802-8222',
      password: 'incorreta',
    })
  }
  assert.equal(response.status, 429)
  assert.ok(response.headers['retry-after'])
})

test('identifica credenciais de teste para enviar X-Test-Token', () => {
  const previousToken = process.env.MERCADO_PAGO_ACCESS_TOKEN
  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'TEST-token-valido'
  assert.equal(isUsingTestCredentials(), true)

  process.env.MERCADO_PAGO_ACCESS_TOKEN = 'APP_USR-token-de-producao'
  assert.equal(isUsingTestCredentials(), false)

  if (previousToken === undefined) {
    delete process.env.MERCADO_PAGO_ACCESS_TOKEN
  } else {
    process.env.MERCADO_PAGO_ACCESS_TOKEN = previousToken
  }
})

test('incrementa tentativas de pagamento sem perder atualizacoes concorrentes', async () => {
  await createOrder({
    id: 'order-payment-attempts',
    user_id: 'customer-payment-attempts',
    status: 'pending',
    restaurant_status: 'awaiting_payment',
    payment_attempts: 0,
    customer: {},
    items: [],
    subtotal: 0,
    total: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const attempts = await Promise.all([
    incrementPaymentAttempts('order-payment-attempts'),
    incrementPaymentAttempts('order-payment-attempts'),
  ])

  assert.deepEqual(attempts.sort(), [1, 2])
  assert.equal((await findOrder('order-payment-attempts')).payment_attempts, 2)
})
