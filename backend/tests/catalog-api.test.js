import assert from 'node:assert/strict'
import { copyFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import request from 'supertest'

const catalogFile = path.join(
  os.tmpdir(),
  `encanto-catalog-test-${process.pid}.json`,
)
process.env.CATALOG_FILE = catalogFile
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.ADMIN_PASSWORD = 'senha-forte-de-teste'
process.env.SESSION_SECRET = 'segredo-de-sessao-com-mais-de-24-caracteres'

const { createApp } = await import('../app.js')

test.before(async () => {
  await copyFile(
    new URL('../catalog.json', import.meta.url),
    catalogFile,
  )
})

test.after(async () => {
  await rm(catalogFile, { force: true })
})

test('publica catálogo e protege todo o CRUD do gestor', async () => {
  const app = createApp()
  const publicCatalog = await request(app).get('/api/catalog')
  assert.equal(publicCatalog.status, 200)
  assert.ok(publicCatalog.body.products.length > 0)

  const unauthorized = await request(app)
    .post('/api/admin/products')
    .send({})
  assert.equal(unauthorized.status, 401)

  const manager = request.agent(app)
  const login = await manager
    .post('/api/admin/login')
    .send({ password: 'senha-forte-de-teste' })
  assert.equal(login.status, 200)

  const category = await manager.post('/api/admin/categories').send({
    id: 'teste-crud',
    name: 'Teste CRUD',
    shortLabel: 'categoria temporária',
  })
  assert.equal(category.status, 201)

  const creation = await manager.post('/api/admin/products').send({
    id: 'produto-crud',
    name: 'Produto CRUD',
    description: 'Produto criado pelo teste automatizado.',
    basePrice: 19.9,
    imageSrc: '',
    fulfillmentType: 'entrega-pronta',
    isAvailable: true,
    isFeatured: false,
    isPromo: false,
    categoryIds: ['teste-crud'],
  })
  assert.equal(creation.status, 201)
  assert.equal(creation.body.product.basePrice, 19.9)

  const update = await manager.put('/api/admin/products/produto-crud').send({
    ...creation.body.product,
    basePrice: 21.5,
    isAvailable: false,
  })
  assert.equal(update.status, 200)
  assert.equal(update.body.product.basePrice, 21.5)
  assert.equal(update.body.product.isAvailable, false)

  const published = await request(app).get('/api/catalog')
  assert.equal(
    published.body.products.find((item) => item.id === 'produto-crud')
      .isAvailable,
    false,
  )

  const categoryInUse = await manager.delete(
    '/api/admin/categories/teste-crud',
  )
  assert.equal(categoryInUse.status, 409)

  assert.equal(
    (await manager.delete('/api/admin/products/produto-crud')).status,
    204,
  )
  assert.equal(
    (await manager.delete('/api/admin/categories/teste-crud')).status,
    204,
  )
})
