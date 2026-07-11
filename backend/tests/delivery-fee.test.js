import assert from 'node:assert/strict'
import test from 'node:test'
import request from 'supertest'

import { createApp } from '../app.js'
import {
  calculateDeliveryFee,
  formatCurrencyBRL,
  getDeliveryZoneByNeighborhood,
  normalizeNeighborhoodName,
  validateDeliveryZone,
} from '../utils/deliveryFee.js'

test('calcula a taxa progressiva com duas casas decimais', () => {
  assert.equal(calculateDeliveryFee(2), 0)
  assert.equal(calculateDeliveryFee(3), 0)
  assert.equal(calculateDeliveryFee(3.5), 6.99)
  assert.equal(calculateDeliveryFee(4), 6.99)
  assert.equal(calculateDeliveryFee(7), 11.49)
  assert.equal(calculateDeliveryFee(18), 27.99)
})

test('normaliza acentos, hífens, espaços e aliases da Cohab VI', () => {
  assert.equal(normalizeNeighborhoodName('  São-José  '), 'sao jose')

  for (const alias of [
    'cohab 6',
    'COHAB VI',
    'Cohab São Francisco',
    'cohab sao francisco',
  ]) {
    const zone = getDeliveryZoneByNeighborhood(alias)
    assert.equal(zone.neighborhood, 'Cohab São Francisco / Cohab VI')
    assert.equal(zone.deliveryFee, 0)
  }
})

test('valida bairro não atendido e formata moeda em BRL', () => {
  assert.equal(validateDeliveryZone('Outro bairro').available, false)
  assert.match(formatCurrencyBRL(11.49), /11,49/)
})

test('expõe zonas ordenadas e calcula entrega sem autenticação', async () => {
  const app = createApp()
  const zones = await request(app).get('/api/delivery-zones')

  assert.equal(zones.status, 200)
  assert.equal(zones.body.zones.length, 44)
  assert.equal(zones.body.calculationMode, 'fixed-zones')

  const delivery = await request(app).post('/api/calculate-delivery').send({
    neighborhood: 'centro',
    deliveryType: 'delivery',
  })
  assert.equal(delivery.status, 200)
  assert.deepEqual(
    {
      available: delivery.body.available,
      neighborhood: delivery.body.neighborhood,
      distanceKm: delivery.body.distanceKm,
      deliveryFee: delivery.body.deliveryFee,
    },
    {
      available: true,
      neighborhood: 'Centro',
      distanceKm: 7,
      deliveryFee: 11.49,
    },
  )

  const pickup = await request(app).post('/api/calculate-delivery').send({
    deliveryType: 'pickup',
  })
  assert.equal(pickup.body.deliveryFee, 0)
})
