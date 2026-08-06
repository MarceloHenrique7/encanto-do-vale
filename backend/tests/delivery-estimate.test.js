import assert from 'node:assert/strict'
import test from 'node:test'

import { calculateDeliveryEstimateMinutes } from '../utils/deliveryEstimate.js'

test('calcula a estimativa de entrega por quilometro iniciado', () => {
  assert.equal(calculateDeliveryEstimateMinutes(0), 30)
  assert.equal(calculateDeliveryEstimateMinutes(1), 30)
  assert.equal(calculateDeliveryEstimateMinutes(1.1), 35)
  assert.equal(calculateDeliveryEstimateMinutes(2), 35)
  assert.equal(calculateDeliveryEstimateMinutes(7), 60)
})
