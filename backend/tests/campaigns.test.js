import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import request from 'supertest'

import { createApp } from '../app.js'
import {
  processCompletedOrderCampaigns,
  resetCampaignsForTests,
} from '../services/campaign-store.js'
import { resetUsersForTests } from '../services/user-store.js'
import { resetOrdersForTests } from '../services/order-store.js'
import { resetAddressesForTests } from '../services/address-store.js'

const campaignsFile = path.join(
  os.tmpdir(),
  `encanto-campaigns-test-${process.pid}.json`,
)
const usersFile = path.join(
  os.tmpdir(),
  `encanto-campaign-users-test-${process.pid}.json`,
)
const ordersFile = path.join(
  os.tmpdir(),
  `encanto-campaign-orders-test-${process.pid}.json`,
)
const addressesFile = path.join(
  os.tmpdir(),
  `encanto-campaign-addresses-test-${process.pid}.json`,
)
process.env.CAMPAIGNS_FILE = campaignsFile
process.env.USERS_FILE = usersFile
process.env.ORDERS_FILE = ordersFile
process.env.ADDRESSES_FILE = addressesFile
process.env.STORE_FORCE_OPEN = 'true'
process.env.ADMIN_PASSWORD = 'senha-forte-de-teste'
process.env.SESSION_SECRET = 'segredo-de-sessao-com-mais-de-24-caracteres'

test.beforeEach(async () => {
  await resetCampaignsForTests()
  await resetUsersForTests()
  await resetOrdersForTests()
  await resetAddressesForTests()
})

test.after(async () => {
  await rm(campaignsFile, { force: true })
  await rm(usersFile, { force: true })
  await rm(ordersFile, { force: true })
  await rm(addressesFile, { force: true })
})

test('gestor cria campanha, distribui voucher e cliente visualiza', async () => {
  const app = createApp()
  const manager = request.agent(app)
  assert.equal(
    (await manager.post('/api/admin/login').send({
      password: 'senha-forte-de-teste',
    })).status,
    200,
  )

  const customer = request.agent(app)
  const access = await customer.post('/api/auth/guest').send({
    name: 'Cliente da Campanha',
    phone: '(75) 98888-4400',
  })
  assert.equal(access.status, 200)

  const creation = await manager.post('/api/admin/campaigns').send({
    name: 'Semana da Pele',
    type: 'voucher',
    headline: 'Depilação gratuita',
    description: 'Parceria especial para clientes.',
    benefit: 'Axila ou barba grátis e até 80% em outras áreas.',
    partnerName: 'Clínica Parceira',
    codePrefix: 'PELE',
    perCustomerLimit: 1,
  })
  assert.equal(creation.status, 200)
  assert.equal(creation.body.campaign.id, 'semana-da-pele')

  const distribution = await manager
    .post('/api/admin/campaigns/semana-da-pele/distribute')
    .send({ customerIds: [access.body.user.id] })
  assert.equal(distribution.status, 201)
  assert.equal(distribution.body.distributed, 1)
  assert.match(distribution.body.vouchers[0].code, /^PELE-[A-F0-9]{8}$/)

  const repeated = await manager
    .post('/api/admin/campaigns/semana-da-pele/distribute')
    .send({ customerIds: [access.body.user.id] })
  assert.equal(repeated.body.distributed, 0)

  const wallet = await customer.get('/api/campaigns')
  assert.equal(wallet.status, 200)
  assert.equal(wallet.body.assignments.length, 1)
  assert.equal(wallet.body.assignments[0].campaign.name, 'Semana da Pele')
  assert.equal(wallet.body.assignments[0].voucher.status, 'available')

  const voucherId = wallet.body.assignments[0].voucher.id
  const used = await manager
    .patch(`/api/admin/campaign-vouchers/${voucherId}`)
    .send({ status: 'used' })
  assert.equal(used.status, 200)
  assert.equal(used.body.voucher.status, 'used')
})

test('protege APIs de campanhas do gestor', async () => {
  const app = createApp()
  assert.equal((await request(app).get('/api/admin/campaigns')).status, 401)
  assert.equal(
    (await request(app).post('/api/admin/campaigns').send({ name: 'Teste' }))
      .status,
    401,
  )
})

test('distribui campanha automatica sem bloquear a finalizacao do pedido', async () => {
  const app = createApp()
  const manager = request.agent(app)
  await manager.post('/api/admin/login').send({
    password: 'senha-forte-de-teste',
  })
  const customer = request.agent(app)
  const access = await customer.post('/api/auth/guest').send({
    name: 'Cliente Automático',
    phone: '(75) 98888-4411',
  })

  await manager.post('/api/admin/campaigns').send({
    name: 'Comprou Ganhou',
    benefit: 'Um presente para você.',
    autoDistributeCompletedOrders: true,
  })

  const distributed = await processCompletedOrderCampaigns({
    id: 'pedido-finalizado',
    user_id: access.body.user.id,
    restaurant_status: 'completed',
  })
  assert.equal(distributed, 1)
  assert.equal((await customer.get('/api/campaigns')).body.assignments.length, 1)
})

test('aplica cupom comercial no checkout com pedido minimo e limite por cliente', async () => {
  const app = createApp()
  const manager = request.agent(app)
  await manager.post('/api/admin/login').send({
    password: 'senha-forte-de-teste',
  })
  const creation = await manager.post('/api/admin/campaigns').send({
    name: 'Desconto de Dez',
    type: 'coupon',
    benefit: 'R$ 10 de desconto.',
    publicCouponCode: 'DESCONTO10',
    discountType: 'fixed',
    discountValue: 10,
    minimumOrder: 50,
    perCustomerLimit: 1,
  })
  assert.equal(creation.status, 200)

  const customer = request.agent(app)
  await customer.post('/api/auth/guest').send({
    name: 'Cliente do Cupom',
    phone: '(75) 98888-4422',
  })

  const preview = await customer.post('/api/campaigns/validate').send({
    code: 'desconto10',
    subtotal: 59.96,
    deliveryFee: 11.49,
  })
  assert.equal(preview.status, 200)
  assert.equal(preview.body.coupon.discount, 10)

  const orderPayload = {
    customer: {
      name: 'Cliente do Cupom',
      phone: '75988884422',
      address: 'Rua das Flores',
      number: '50',
      neighborhood: 'Centro',
    },
    items: [
      {
        id: 'bolo-de-pote-kitkat-supreme',
        quantity: 4,
        unit_price: 14.99,
      },
    ],
    delivery_method: 'delivery',
    payment_method: 'card-delivery',
    campaign_code: 'DESCONTO10',
  }
  const order = await customer.post('/api/orders').send(orderPayload)
  assert.equal(order.status, 201, JSON.stringify(order.body))
  assert.equal(order.body.total, 61.45)

  const lookup = await customer.get(`/api/orders/${order.body.order_id}`)
  assert.equal(lookup.body.campaign_discount, 10)
  assert.equal(lookup.body.total, 61.45)

  const repeated = await customer.post('/api/orders').send(orderPayload)
  assert.equal(repeated.status, 409)
  assert.match(repeated.body.error, /limite de uso/)
})

test('publica no máximo duas campanhas ativas no destaque do cardapio', async () => {
  const app = createApp()
  const manager = request.agent(app)
  await manager.post('/api/admin/login').send({
    password: 'senha-forte-de-teste',
  })

  for (const name of ['Destaque Um', 'Destaque Dois']) {
    const creation = await manager.post('/api/admin/campaigns').send({
      name,
      type: 'announcement',
      headline: `${name} no cardápio`,
      benefit: 'Uma novidade especial.',
      imageSrc: 'https://example.com/campaign.jpg',
      showInHero: true,
    })
    assert.equal(creation.status, 200)
    assert.equal(creation.body.campaign.showInHero, true)
  }

  const highlights = await request(app).get('/api/campaign-highlights')
  assert.equal(highlights.status, 200)
  assert.equal(highlights.body.campaigns.length, 2)
  assert.equal(highlights.body.campaigns[0].showInHero, undefined)

  const third = await manager.post('/api/admin/campaigns').send({
    name: 'Destaque Três',
    type: 'gift',
    benefit: 'Outro benefício.',
    showInHero: true,
  })
  assert.equal(third.status, 409)
  assert.match(third.body.error, /duas campanhas/)
})
