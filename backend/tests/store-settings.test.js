import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import request from 'supertest'

const settingsFile = path.join(os.tmpdir(), `encanto-settings-${process.pid}.json`)
process.env.STORE_SETTINGS_FILE = settingsFile
process.env.ADMIN_PASSWORD = 'senha-forte-de-teste'
process.env.SESSION_SECRET = 'segredo-de-sessao-com-mais-de-24-caracteres'

const { createApp } = await import('../app.js')
const { normalizeOrder } = await import('../api/_payment-utils.js')

test.after(async () => rm(settingsFile, { force: true }))

test('gestor altera horários, pedido mínimo, bairros e taxas', async () => {
  const app = createApp()
  const unauthorized = await request(app).get('/api/admin/store-settings')
  assert.equal(unauthorized.status, 401)

  const manager = request.agent(app)
  assert.equal((await manager.post('/api/admin/login').send({ password: 'senha-forte-de-teste' })).status, 200)

  const weeklyHours = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(
    (label, day) => ({ day, label, open: '08:00', close: '20:00', closed: day === 0 }),
  )
  const update = await manager.put('/api/admin/store-settings').send({
    minimumOrder: 25,
    weeklyHours,
    deliveryZones: [
      { neighborhood: 'Bairro Teste', distanceKm: 4.5, deliveryFee: 8.75, aliases: ['teste'] },
    ],
  })
  assert.equal(update.status, 200)
  assert.equal(update.body.settings.minimumOrder, 25)
  assert.equal(update.body.settings.deliveryZones[0].deliveryFee, 8.75)

  const publicSettings = await request(app).get('/api/store-settings')
  assert.equal(publicSettings.body.minimumOrder, 25)
  assert.equal(publicSettings.body.deliveryZones, undefined)

  const delivery = await request(app).post('/api/calculate-delivery').send({ neighborhood: 'teste' })
  assert.equal(delivery.body.available, true)
  assert.equal(delivery.body.deliveryFee, 8.75)

  const catalog = await request(app).get('/api/catalog')
  const product = catalog.body.products.find((entry) => entry.isAvailable)
  const belowMinimum = normalizeOrder({
    customer: {
      name: 'Cliente Teste',
      phone: '87999999999',
      email: 'cliente@teste.com',
      address: 'Rua Teste, 10',
      neighborhood: 'Bairro Teste',
    },
    deliveryMethod: 'delivery',
    items: [{
      id: 'linha-1',
      productId: product.id,
      quantity: 1,
      unitPrice: product.basePrice,
    }],
  })
  assert.match(belowMinimum.error, /pedido mínimo/i)
})
