import assert from 'node:assert/strict'
import { readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const loyaltyFile = path.join(os.tmpdir(), `encanto-loyalty-${process.pid}.json`)
process.env.LOYALTY_FILE = loyaltyFile
delete process.env.DATABASE_URL

const {
  adjustPoints,
  applyRedemption,
  getCustomerLoyalty,
  processOrderLoyalty,
  redeemReward,
  saveReward,
} = await import('../services/loyalty-store.js')

const customerId = '11111111-1111-4111-8111-111111111111'
const completedOrder = {
  id: '22222222-2222-4222-8222-222222222222',
  user_id: customerId,
  status: 'paid',
  restaurant_status: 'completed',
  subtotal: 120.9,
  delivery_fee: 18,
  total: 138.9,
}

test.beforeEach(async () => {
  await rm(loyaltyFile, { force: true })
})

test.after(async () => {
  await rm(loyaltyFile, { force: true })
})

test('pedido concluído pontua sem incluir entrega e não duplica', async () => {
  await processOrderLoyalty(completedOrder)
  await processOrderLoyalty(completedOrder)
  const loyalty = await getCustomerLoyalty(customerId)
  assert.equal(loyalty.account.current_balance, 120)
  assert.equal(loyalty.transactions.filter((item) => item.type === 'earn').length, 1)
})

test('pedido pendente ou cancelado não gera pontos', async () => {
  await processOrderLoyalty({ ...completedOrder, id: 'pending', restaurant_status: 'preparing' })
  await processOrderLoyalty({ ...completedOrder, id: 'cancelled', restaurant_status: 'cancelled' })
  const loyalty = await getCustomerLoyalty(customerId)
  assert.equal(loyalty.account.current_balance, 0)
})

test('cancelamento posterior estorna o crédito e mantém histórico', async () => {
  await processOrderLoyalty(completedOrder)
  await processOrderLoyalty({ ...completedOrder, restaurant_status: 'cancelled' })
  const loyalty = await getCustomerLoyalty(customerId)
  assert.equal(loyalty.account.current_balance, 0)
  assert.equal(loyalty.transactions.some((item) => item.type === 'reversal'), true)
})

test('saldo insuficiente não resgata e concorrência não deixa saldo negativo', async () => {
  await assert.rejects(() => redeemReward(customerId, 'brigadeiro-gratis'), /insuficiente/)
  await processOrderLoyalty(completedOrder)
  const results = await Promise.allSettled([
    redeemReward(customerId, 'brigadeiro-gratis'),
    redeemReward(customerId, 'brigadeiro-gratis'),
  ])
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1)
  const loyalty = await getCustomerLoyalty(customerId)
  assert.equal(loyalty.account.current_balance, 20)
})

test('recompensa inativa ou esgotada não pode ser resgatada', async () => {
  await processOrderLoyalty(completedOrder)
  await saveReward('', {
    id: 'inativa',
    name: 'Inativa',
    pointsCost: 10,
    active: false,
    stock: 10,
    perCustomerLimit: 1,
  })
  await saveReward('', {
    id: 'esgotada',
    name: 'Esgotada',
    pointsCost: 10,
    active: true,
    stock: 0,
    perCustomerLimit: 1,
  })
  await assert.rejects(() => redeemReward(customerId, 'inativa'), /não está disponível/)
  await assert.rejects(() => redeemReward(customerId, 'esgotada'), /não está disponível/)
})

test('ajuste manual exige justificativa e fica registrado', async () => {
  await assert.rejects(() => adjustPoints(customerId, 50, ''), /justificativa/)
  await adjustPoints(customerId, 50, 'Bônus de atendimento')
  const loyalty = await getCustomerLoyalty(customerId)
  assert.equal(loyalty.account.current_balance, 50)
  assert.equal(loyalty.transactions[0].type, 'manual_credit')
  assert.equal(loyalty.transactions[0].description, 'Bônus de atendimento')
})

test('recompensa utilizada não pode ser reutilizada', async () => {
  await processOrderLoyalty(completedOrder)
  const { redemption } = await redeemReward(customerId, 'brigadeiro-gratis')
  const rewardOrder = { ...completedOrder, id: '33333333-3333-4333-8333-333333333333' }
  await applyRedemption(customerId, redemption.code, rewardOrder)
  await assert.rejects(
    () => applyRedemption(customerId, redemption.code, rewardOrder),
    /inválido ou já utilizado/,
  )
})

test('pontos vencidos são removidos e registrados', async () => {
  await processOrderLoyalty(completedOrder)
  const database = JSON.parse(await readFile(loyaltyFile, 'utf8'))
  const earn = database.transactions.find((item) => item.type === 'earn')
  earn.expires_at = new Date(Date.now() - 60_000).toISOString()
  await writeFile(loyaltyFile, JSON.stringify(database), 'utf8')
  const loyalty = await getCustomerLoyalty(customerId)
  assert.equal(loyalty.account.current_balance, 0)
  assert.equal(loyalty.transactions.some((item) => item.type === 'expiration'), true)
})

test('cancelamento restaura pontos e estoque de recompensa utilizada', async () => {
  await processOrderLoyalty(completedOrder)
  const { redemption } = await redeemReward(customerId, 'brigadeiro-gratis')
  const rewardOrder = {
    ...completedOrder,
    id: '44444444-4444-4444-8444-444444444444',
    restaurant_status: 'preparing',
  }
  await applyRedemption(customerId, redemption.code, rewardOrder)
  await processOrderLoyalty({ ...rewardOrder, restaurant_status: 'cancelled' })
  const loyalty = await getCustomerLoyalty(customerId)
  assert.equal(loyalty.account.current_balance, 120)
  assert.equal(
    loyalty.redemptions.find((item) => item.id === redemption.id).status,
    'restored',
  )
})
