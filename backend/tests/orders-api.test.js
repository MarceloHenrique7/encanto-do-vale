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
import { createOrder, resetOrdersForTests } from '../services/order-store.js'
import { updateOrder } from '../services/order-store.js'
import { resetUsersForTests } from '../services/user-store.js'

const ordersFile = path.join(
  os.tmpdir(),
  `encanto-orders-test-${process.pid}.json`,
)
const usersFile = path.join(
  os.tmpdir(),
  `encanto-users-test-${process.pid}.json`,
)
process.env.ORDERS_FILE = ordersFile
process.env.USERS_FILE = usersFile
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.ADMIN_PASSWORD = 'senha-forte-de-teste'
process.env.SESSION_SECRET = 'segredo-de-sessao-com-mais-de-24-caracteres'

test.beforeEach(async () => {
  await resetOrdersForTests()
  await resetUsersForTests()
})

test.after(async () => {
  await rm(ordersFile, { force: true })
  await rm(usersFile, { force: true })
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
          unit_price: 14.99,
        },
      ],
      delivery_fee: 0.01,
      subtotal: 0.01,
      total: 0.02,
    })

  assert.equal(creation.status, 201)
  assert.equal(creation.body.total, 41.47)
  assert.match(creation.body.order_id, /^[0-9a-f-]{36}$/)

  const lookup = await customer.get(
    `/api/orders/${creation.body.order_id}`,
  )
  assert.equal(lookup.status, 200)
  assert.equal(lookup.body.status, 'pending')
  assert.equal(lookup.body.items[0].name, 'Bolo de Pote Kitkat Supreme')
  assert.equal(lookup.body.subtotal, 29.98)
  assert.equal(lookup.body.delivery_fee, 11.49)
  assert.equal(lookup.body.neighborhood, 'Centro')
  assert.equal(lookup.body.distanceKm, 7)
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

test('mapeia status do Mercado Pago para o pedido interno', () => {
  assert.equal(mapPaymentStatus('approved'), 'paid')
  assert.equal(mapPaymentStatus('pending'), 'waiting_payment')
  assert.equal(mapPaymentStatus('in_process'), 'waiting_payment')
  assert.equal(mapPaymentStatus('rejected'), 'failed')
  assert.equal(mapPaymentStatus('refunded'), 'failed')
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

  const manager = request.agent(app)
  const login = await manager
    .post('/api/admin/login')
    .send({ password: 'senha-forte-de-teste' })
  assert.equal(login.status, 200)
  assert.match(login.headers['set-cookie'][0], /HttpOnly/)

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

test('lista historico de pedidos apenas do cliente logado', async () => {
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
  assert.equal(history.body.orders.length, 2)
  assert.equal(history.body.orders[0].order_id, secondOrder.body.order_id)
  assert.deepEqual(
    history.body.orders.map((order) => order.order_id).sort(),
    [firstOrder.body.order_id, secondOrder.body.order_id].sort(),
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

test('cadastra e autentica automaticamente ao entrar com telefone novo', async () => {
  const app = createApp()
  const customer = request.agent(app)

  const login = await customer.post('/api/auth/login/phone').send({
    phone: '(87) 98802-8111',
    name: 'Marcelo salvo anteriormente',
  })
  assert.equal(login.status, 200)
  assert.equal(login.body.authenticated, true)
  assert.equal(login.body.user.name, '(sem nome)')
  assert.equal(login.body.user.phone, '+5587988028111')

  const session = await customer.get('/api/auth/session')
  assert.equal(session.status, 200)
  assert.equal(session.body.authenticated, true)
  assert.equal(session.body.user.phone, '+5587988028111')
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
