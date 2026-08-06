import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPool, shouldUsePostgres } from './postgres.js'
import { listUsers } from './user-store.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.resolve(serviceDirectory, '../data/loyalty.json')
let writeQueue = Promise.resolve()

const defaultSettings = {
  enabled: true,
  points: 1,
  amount: 1,
  validityDays: 365,
  minimumOrder: 0,
  releaseStatus: 'completed',
}

const starterRewards = [
  {
    id: 'brigadeiro-gratis',
    name: 'Brigadeiro grátis',
    description: 'Ganhe um brigadeiro artesanal no próximo pedido.',
    imageSrc: '',
    pointsCost: 100,
    active: true,
    validFrom: '',
    validUntil: '',
    stock: 100,
    perCustomerLimit: 3,
    minimumOrder: 0,
    productId: '',
    instructions: 'Selecione o código no carrinho antes de finalizar.',
  },
]

function databaseFile() {
  return process.env.LOYALTY_FILE
    ? path.resolve(process.env.LOYALTY_FILE)
    : defaultFile
}

function emptyDatabase() {
  return {
    settings: defaultSettings,
    accounts: [],
    transactions: [],
    rewards: starterRewards,
    redemptions: [],
  }
}

function normalizeDatabase(value) {
  const empty = emptyDatabase()
  return {
    settings: { ...defaultSettings, ...(value?.settings ?? {}) },
    accounts: Array.isArray(value?.accounts) ? value.accounts : [],
    transactions: Array.isArray(value?.transactions) ? value.transactions : [],
    rewards: Array.isArray(value?.rewards) ? value.rewards : empty.rewards,
    redemptions: Array.isArray(value?.redemptions) ? value.redemptions : [],
  }
}

async function readDatabase() {
  try {
    return normalizeDatabase(JSON.parse(await readFile(databaseFile(), 'utf8')))
  } catch (error) {
    if (error?.code === 'ENOENT') return emptyDatabase()
    throw error
  }
}

async function writeDatabase(database) {
  const file = databaseFile()
  const temporaryFile = `${file}.${process.pid}.tmp`
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(temporaryFile, `${JSON.stringify(database, null, 2)}\n`, 'utf8')
  await rename(temporaryFile, file)
}

function serializedWrite(operation) {
  const next = writeQueue.then(operation, operation)
  writeQueue = next.catch(() => {})
  return next
}

function accountFor(database, customerId) {
  let account = database.accounts.find((item) => item.customer_id === customerId)
  if (!account) {
    const now = new Date().toISOString()
    account = {
      id: randomUUID(),
      customer_id: customerId,
      current_balance: 0,
      pending_balance: 0,
      created_at: now,
      updated_at: now,
    }
    database.accounts.push(account)
  }
  return account
}

function rewardIsAvailable(reward, now = new Date()) {
  return (
    reward.active &&
    (!reward.validFrom || new Date(reward.validFrom) <= now) &&
    (!reward.validUntil || new Date(reward.validUntil) >= now) &&
    (reward.stock === null || reward.stock > 0)
  )
}

function expireLocal(database, customerId) {
  const account = accountFor(database, customerId)
  const now = Date.now()
  const expiring = database.transactions.filter(
    (transaction) =>
      transaction.customer_id === customerId &&
      transaction.type === 'earn' &&
      transaction.status === 'active' &&
      transaction.expires_at &&
      new Date(transaction.expires_at).getTime() <= now,
  )
  for (const transaction of expiring) {
    const points = Math.min(account.current_balance, transaction.points)
    transaction.status = 'expired'
    if (points > 0) {
      database.transactions.push({
        id: randomUUID(),
        customer_id: customerId,
        order_id: transaction.order_id,
        reward_id: null,
        type: 'expiration',
        points: -points,
        description: 'Pontos expirados',
        status: 'active',
        expires_at: null,
        created_at: new Date().toISOString(),
        created_by: 'system',
      })
      account.current_balance -= points
    }
  }
  account.updated_at = new Date().toISOString()
}

function customerView(database, customerId) {
  expireLocal(database, customerId)
  const account = accountFor(database, customerId)
  const rewards = database.rewards.filter((reward) => rewardIsAvailable(reward))
  return {
    settings: database.settings,
    account,
    transactions: database.transactions
      .filter((item) => item.customer_id === customerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    rewards,
    redemptions: database.redemptions
      .filter((item) => item.customer_id === customerId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  }
}

export async function getCustomerLoyalty(customerId) {
  if (!shouldUsePostgres()) {
    return serializedWrite(async () => {
      const database = await readDatabase()
      const view = customerView(database, customerId)
      await writeDatabase(database)
      return view
    })
  }
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const settingsResult = await client.query(
      `select data from loyalty_settings where key = 'main'`,
    )
    const settings = { ...defaultSettings, ...(settingsResult.rows[0]?.data ?? {}) }
    await client.query(
      `insert into loyalty_accounts (customer_id) values ($1)
       on conflict (customer_id) do nothing`,
      [customerId],
    )
    await expirePostgres(client, customerId)
    const account = await client.query(
      'select * from loyalty_accounts where customer_id = $1',
      [customerId],
    )
    const transactions = await client.query(
      'select * from loyalty_transactions where customer_id = $1 order by created_at desc limit 100',
      [customerId],
    )
    const rewards = await client.query(
      `select * from loyalty_rewards
       where active = true
         and (valid_from is null or valid_from <= now())
         and (valid_until is null or valid_until >= now())
         and (stock is null or stock > 0)
       order by points_cost`,
    )
    const redemptions = await client.query(
      'select * from loyalty_redemptions where customer_id = $1 order by created_at desc limit 100',
      [customerId],
    )
    await client.query('commit')
    return {
      settings,
      account: account.rows[0],
      transactions: transactions.rows,
      rewards: rewards.rows,
      redemptions: redemptions.rows,
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

async function expirePostgres(client, customerId) {
  const expired = await client.query(
    `select id, points, order_id from loyalty_transactions
     where customer_id = $1 and type = 'earn' and status = 'active'
       and expires_at is not null and expires_at <= now()
     for update`,
    [customerId],
  )
  for (const transaction of expired.rows) {
    const account = await client.query(
      'select current_balance from loyalty_accounts where customer_id = $1 for update',
      [customerId],
    )
    const points = Math.min(account.rows[0]?.current_balance ?? 0, transaction.points)
    await client.query(
      `update loyalty_transactions set status = 'expired' where id = $1`,
      [transaction.id],
    )
    if (points > 0) {
      await client.query(
        `update loyalty_accounts set current_balance = current_balance - $2, updated_at = now()
         where customer_id = $1`,
        [customerId, points],
      )
      await client.query(
        `insert into loyalty_transactions
          (id, customer_id, order_id, type, points, description, created_by)
         values ($1, $2, $3, 'expiration', $4, 'Pontos expirados', 'system')`,
        [randomUUID(), customerId, transaction.order_id, -points],
      )
    }
  }
}

export async function processOrderLoyalty(order) {
  if (!order?.user_id) return null
  if (shouldUsePostgres()) return processOrderPostgres(order)
  return serializedWrite(async () => {
    const database = await readDatabase()
    const settings = database.settings
    const account = accountFor(database, order.user_id)
    const earned = database.transactions.find(
      (item) => item.order_id === order.id && item.type === 'earn',
    )
    const shouldEarn =
      settings.enabled &&
      order.restaurant_status === settings.releaseStatus &&
      order.status !== 'failed' &&
      order.status !== 'cancelled' &&
      Number(order.subtotal) >= settings.minimumOrder
    if (shouldEarn && !earned) {
      const points =
        Math.floor(Number(order.subtotal) / settings.amount) * settings.points
      if (points > 0) {
        const now = new Date()
        const expires = new Date(now)
        expires.setDate(expires.getDate() + settings.validityDays)
        database.transactions.push({
          id: randomUUID(),
          customer_id: order.user_id,
          order_id: order.id,
          reward_id: null,
          type: 'earn',
          points,
          description: `Pontos do pedido #${order.id.slice(0, 8)}`,
          status: 'active',
          expires_at: expires.toISOString(),
          created_at: now.toISOString(),
          created_by: 'system',
        })
        account.current_balance += points
      }
    }
    const mustReverse =
      earned &&
      earned.status === 'active' &&
      (order.restaurant_status === 'cancelled' ||
        order.status === 'failed' ||
        order.status === 'cancelled')
    if (mustReverse) {
      const points = Math.min(account.current_balance, earned.points)
      earned.status = 'reversed'
      database.transactions.push({
        id: randomUUID(),
        customer_id: order.user_id,
        order_id: order.id,
        reward_id: null,
        type: 'reversal',
        points: -points,
        description: `Estorno do pedido #${order.id.slice(0, 8)}`,
        status: 'active',
        expires_at: null,
        created_at: new Date().toISOString(),
        created_by: 'system',
      })
      account.current_balance -= points
    }
    if (
      order.restaurant_status === 'cancelled' ||
      ['failed', 'cancelled'].includes(order.status)
    ) {
      const redemption = database.redemptions.find(
        (item) => item.order_id === order.id && item.status === 'used',
      )
      if (redemption) {
        const reward = database.rewards.find((item) => item.id === redemption.reward_id)
        redemption.status = 'restored'
        account.current_balance += redemption.points_used
        if (reward?.stock !== null && reward) reward.stock += 1
        database.transactions.push({
          id: randomUUID(), customer_id: order.user_id, order_id: order.id,
          reward_id: redemption.reward_id, type: 'reversal',
          points: redemption.points_used, description: 'Resgate restaurado por cancelamento',
          status: 'active', expires_at: null, created_at: new Date().toISOString(),
          created_by: 'system',
        })
      }
    }
    account.updated_at = new Date().toISOString()
    await writeDatabase(database)
    return account
  })
}

async function processOrderPostgres(order) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const settingsResult = await client.query(
      `select data from loyalty_settings where key = 'main'`,
    )
    const settings = { ...defaultSettings, ...(settingsResult.rows[0]?.data ?? {}) }
    await client.query(
      `insert into loyalty_accounts (customer_id) values ($1)
       on conflict (customer_id) do nothing`,
      [order.user_id],
    )
    const earn = await client.query(
      `select * from loyalty_transactions
       where order_id = $1 and type = 'earn' for update`,
      [order.id],
    )
    const shouldEarn =
      settings.enabled &&
      order.restaurant_status === settings.releaseStatus &&
      !['failed', 'cancelled'].includes(order.status) &&
      Number(order.subtotal) >= settings.minimumOrder
    if (shouldEarn && !earn.rows[0]) {
      const points =
        Math.floor(Number(order.subtotal) / settings.amount) * settings.points
      if (points > 0) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + settings.validityDays)
        await client.query(
          `insert into loyalty_transactions
            (id, customer_id, order_id, type, points, description, expires_at, created_by)
           values ($1, $2, $3, 'earn', $4, $5, $6, 'system')`,
          [
            randomUUID(),
            order.user_id,
            order.id,
            points,
            `Pontos do pedido #${order.id.slice(0, 8)}`,
            expiresAt,
          ],
        )
        await client.query(
          `update loyalty_accounts set current_balance = current_balance + $2, updated_at = now()
           where customer_id = $1`,
          [order.user_id, points],
        )
      }
    }
    const mustReverse =
      earn.rows[0] &&
      earn.rows[0].status === 'active' &&
      (order.restaurant_status === 'cancelled' ||
        ['failed', 'cancelled'].includes(order.status))
    if (mustReverse) {
      const account = await client.query(
        `select current_balance from loyalty_accounts where customer_id = $1 for update`,
        [order.user_id],
      )
      const points = Math.min(account.rows[0].current_balance, earn.rows[0].points)
      await client.query(
        `update loyalty_transactions set status = 'reversed' where id = $1`,
        [earn.rows[0].id],
      )
      await client.query(
        `insert into loyalty_transactions
          (id, customer_id, order_id, type, points, description, created_by)
         values ($1, $2, $3, 'reversal', $4, $5, 'system')`,
        [
          randomUUID(),
          order.user_id,
          order.id,
          -points,
          `Estorno do pedido #${order.id.slice(0, 8)}`,
        ],
      )
      await client.query(
        `update loyalty_accounts set current_balance = current_balance - $2, updated_at = now()
         where customer_id = $1`,
        [order.user_id, points],
      )
    }
    if (
      order.restaurant_status === 'cancelled' ||
      ['failed', 'cancelled'].includes(order.status)
    ) {
      const redemption = await client.query(
        `select * from loyalty_redemptions
         where order_id = $1 and status = 'used' for update`,
        [order.id],
      )
      if (redemption.rows[0]) {
        const restored = redemption.rows[0]
        await client.query(
          `update loyalty_redemptions set status = 'restored' where id = $1`,
          [restored.id],
        )
        await client.query(
          `update loyalty_accounts set current_balance = current_balance + $2, updated_at = now()
           where customer_id = $1`,
          [order.user_id, restored.points_used],
        )
        await client.query(
          `update loyalty_rewards set stock = stock + 1
           where id = $1 and stock is not null`,
          [restored.reward_id],
        )
        await client.query(
          `insert into loyalty_transactions
            (id, customer_id, order_id, reward_id, type, points, description, created_by)
           values ($1,$2,$3,$4,'reversal',$5,'Resgate restaurado por cancelamento','system')`,
          [randomUUID(), order.user_id, order.id, restored.reward_id, restored.points_used],
        )
      }
    }
    await client.query('commit')
    return true
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

function redemptionCode() {
  return `DOCE-${randomBytes(4).toString('hex').toUpperCase()}`
}

export async function redeemReward(customerId, rewardId) {
  if (shouldUsePostgres()) return redeemPostgres(customerId, rewardId)
  return serializedWrite(async () => {
    const database = await readDatabase()
    expireLocal(database, customerId)
    const reward = database.rewards.find((item) => item.id === rewardId)
    if (!reward || !rewardIsAvailable(reward)) {
      throw new Error('Esta recompensa não está disponível.')
    }
    const account = accountFor(database, customerId)
    if (account.current_balance < reward.pointsCost) {
      throw new Error('Saldo de pontos insuficiente.')
    }
    const count = database.redemptions.filter(
      (item) => item.customer_id === customerId && item.reward_id === rewardId,
    ).length
    if (count >= reward.perCustomerLimit) {
      throw new Error('Você atingiu o limite desta recompensa.')
    }
    const now = new Date().toISOString()
    const redemption = {
      id: randomUUID(),
      code: redemptionCode(),
      customer_id: customerId,
      reward_id: rewardId,
      points_used: reward.pointsCost,
      status: 'available',
      order_id: null,
      created_at: now,
      used_at: null,
    }
    account.current_balance -= reward.pointsCost
    account.updated_at = now
    reward.stock = reward.stock === null ? null : reward.stock - 1
    database.redemptions.push(redemption)
    database.transactions.push({
      id: randomUUID(),
      customer_id: customerId,
      order_id: null,
      reward_id: rewardId,
      type: 'redeem',
      points: -reward.pointsCost,
      description: `Resgate: ${reward.name}`,
      status: 'active',
      expires_at: null,
      created_at: now,
      created_by: customerId,
    })
    await writeDatabase(database)
    return { redemption, reward }
  })
}

async function redeemPostgres(customerId, rewardId) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    await expirePostgres(client, customerId)
    const rewardResult = await client.query(
      `select * from loyalty_rewards where id = $1 for update`,
      [rewardId],
    )
    const reward = rewardResult.rows[0]
    if (
      !reward ||
      !reward.active ||
      (reward.valid_from && new Date(reward.valid_from) > new Date()) ||
      (reward.valid_until && new Date(reward.valid_until) < new Date()) ||
      (reward.stock !== null && reward.stock <= 0)
    ) throw new Error('Esta recompensa não está disponível.')
    const account = await client.query(
      `select * from loyalty_accounts where customer_id = $1 for update`,
      [customerId],
    )
    if (!account.rows[0] || account.rows[0].current_balance < reward.points_cost) {
      throw new Error('Saldo de pontos insuficiente.')
    }
    const count = await client.query(
      `select count(*)::int as count from loyalty_redemptions
       where customer_id = $1 and reward_id = $2`,
      [customerId, rewardId],
    )
    if (count.rows[0].count >= reward.per_customer_limit) {
      throw new Error('Você atingiu o limite desta recompensa.')
    }
    const id = randomUUID()
    const code = redemptionCode()
    await client.query(
      `update loyalty_accounts set current_balance = current_balance - $2, updated_at = now()
       where customer_id = $1`,
      [customerId, reward.points_cost],
    )
    if (reward.stock !== null) {
      await client.query('update loyalty_rewards set stock = stock - 1 where id = $1', [rewardId])
    }
    await client.query(
      `insert into loyalty_redemptions
        (id, code, customer_id, reward_id, points_used)
       values ($1, $2, $3, $4, $5)`,
      [id, code, customerId, rewardId, reward.points_cost],
    )
    await client.query(
      `insert into loyalty_transactions
        (id, customer_id, reward_id, type, points, description, created_by)
       values ($1, $2, $3, 'redeem', $4, $5, $6)`,
      [
        randomUUID(),
        customerId,
        rewardId,
        -reward.points_cost,
        `Resgate: ${reward.name}`,
        customerId,
      ],
    )
    await client.query('commit')
    return {
      redemption: { id, code, reward_id: rewardId, points_used: reward.points_cost, status: 'available' },
      reward,
    }
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

export async function applyRedemption(customerId, code, order) {
  if (!code) return null
  if (shouldUsePostgres()) {
    const client = await getPool().connect()
    try {
      await client.query('begin')
      const result = await client.query(
        `select r.*, w.name, w.product_id, w.minimum_order
         from loyalty_redemptions r join loyalty_rewards w on w.id = r.reward_id
         where r.code = $1 and r.customer_id = $2 for update`,
        [code, customerId],
      )
      const redemption = result.rows[0]
      if (!redemption || redemption.status !== 'available') {
        throw new Error('Código de recompensa inválido ou já utilizado.')
      }
      if (Number(order.subtotal) < Number(redemption.minimum_order)) {
        throw new Error('O pedido não atingiu o valor mínimo da recompensa.')
      }
      await client.query(
        `update loyalty_redemptions set status = 'used', order_id = $2, used_at = now()
         where id = $1`,
        [redemption.id, order.id],
      )
      await client.query('commit')
      return redemption
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }
  return serializedWrite(async () => {
    const database = await readDatabase()
    const redemption = database.redemptions.find(
      (item) => item.code === code && item.customer_id === customerId,
    )
    if (!redemption || redemption.status !== 'available') {
      throw new Error('Código de recompensa inválido ou já utilizado.')
    }
    const reward = database.rewards.find((item) => item.id === redemption.reward_id)
    if (!reward || Number(order.subtotal) < reward.minimumOrder) {
      throw new Error('O pedido não atingiu o valor mínimo da recompensa.')
    }
    redemption.status = 'used'
    redemption.order_id = order.id
    redemption.used_at = new Date().toISOString()
    await writeDatabase(database)
    return { ...redemption, name: reward.name, product_id: reward.productId }
  })
}

export async function getAdminLoyalty() {
  if (shouldUsePostgres()) {
    const [settings, rewards, accounts, transactions, redemptions] = await Promise.all([
      getPool().query(`select data from loyalty_settings where key = 'main'`),
      getPool().query('select * from loyalty_rewards order by points_cost'),
      getPool().query(
        `select
           c.id as customer_id,
           coalesce(a.current_balance, 0)::int as current_balance,
           coalesce(a.pending_balance, 0)::int as pending_balance,
           c.name,
           c.phone
         from customers c
         left join loyalty_accounts a on a.customer_id = c.id
         order by coalesce(a.current_balance, 0) desc, c.name`,
      ),
      getPool().query('select * from loyalty_transactions order by created_at desc limit 200'),
      getPool().query('select * from loyalty_redemptions order by created_at desc limit 200'),
    ])
    return {
      settings: { ...defaultSettings, ...(settings.rows[0]?.data ?? {}) },
      rewards: rewards.rows,
      accounts: accounts.rows,
      transactions: transactions.rows,
      redemptions: redemptions.rows,
    }
  }
  await writeQueue
  const database = await readDatabase()
  const users = await listUsers()
  const accountMap = new Map(
    database.accounts.map((account) => [account.customer_id, account]),
  )
  return {
    ...database,
    accounts: users
      .map((user) => ({
        customer_id: user.id,
        current_balance: accountMap.get(user.id)?.current_balance ?? 0,
        pending_balance: accountMap.get(user.id)?.pending_balance ?? 0,
        name: user.name,
        phone: user.phone,
      }))
      .sort(
        (first, second) =>
          second.current_balance - first.current_balance ||
          String(first.name).localeCompare(String(second.name), 'pt-BR'),
      ),
  }
}

export async function saveLoyaltySettings(settings) {
  const normalized = {
    enabled: settings.enabled !== false,
    points: Math.max(1, Number.parseInt(settings.points, 10) || 1),
    amount: Math.max(0.01, Number(settings.amount) || 1),
    validityDays: Math.max(1, Number.parseInt(settings.validityDays, 10) || 365),
    minimumOrder: Math.max(0, Number(settings.minimumOrder) || 0),
    releaseStatus: ['completed', 'ready'].includes(settings.releaseStatus)
      ? settings.releaseStatus
      : 'completed',
  }
  if (shouldUsePostgres()) {
    await getPool().query(
      `insert into loyalty_settings (key, data) values ('main', $1::jsonb)
       on conflict (key) do update set data = excluded.data, updated_at = now()`,
      [JSON.stringify(normalized)],
    )
    return normalized
  }
  return serializedWrite(async () => {
    const database = await readDatabase()
    database.settings = normalized
    await writeDatabase(database)
    return normalized
  })
}

export async function saveReward(rewardId, reward) {
  const normalized = {
    id: reward.id,
    name: reward.name,
    description: reward.description ?? '',
    imageSrc: reward.imageSrc ?? reward.image_src ?? '',
    pointsCost: Math.max(1, Number.parseInt(reward.pointsCost ?? reward.points_cost, 10) || 1),
    active: reward.active !== false,
    validFrom: reward.validFrom ?? reward.valid_from ?? '',
    validUntil: reward.validUntil ?? reward.valid_until ?? '',
    stock: reward.stock === null ? null : Math.max(0, Number.parseInt(reward.stock, 10) || 0),
    perCustomerLimit: Math.max(1, Number.parseInt(reward.perCustomerLimit ?? reward.per_customer_limit, 10) || 1),
    minimumOrder: Math.max(0, Number(reward.minimumOrder ?? reward.minimum_order) || 0),
    productId: reward.productId ?? reward.product_id ?? '',
    instructions: reward.instructions ?? '',
  }
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `insert into loyalty_rewards
        (id, name, description, image_src, points_cost, active, valid_from, valid_until,
         stock, per_customer_limit, minimum_order, product_id, instructions)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       on conflict (id) do update set name=excluded.name, description=excluded.description,
         image_src=excluded.image_src, points_cost=excluded.points_cost, active=excluded.active,
         valid_from=excluded.valid_from, valid_until=excluded.valid_until, stock=excluded.stock,
         per_customer_limit=excluded.per_customer_limit, minimum_order=excluded.minimum_order,
         product_id=excluded.product_id, instructions=excluded.instructions, updated_at=now()
       returning *`,
      [
        normalized.id, normalized.name, normalized.description, normalized.imageSrc,
        normalized.pointsCost, normalized.active, normalized.validFrom || null,
        normalized.validUntil || null, normalized.stock, normalized.perCustomerLimit,
        normalized.minimumOrder, normalized.productId || null, normalized.instructions,
      ],
    )
    return result.rows[0]
  }
  return serializedWrite(async () => {
    const database = await readDatabase()
    const index = database.rewards.findIndex((item) => item.id === rewardId)
    if (index >= 0) database.rewards[index] = normalized
    else database.rewards.push(normalized)
    await writeDatabase(database)
    return normalized
  })
}

export async function deleteReward(rewardId) {
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `delete from loyalty_rewards r
       where r.id = $1
         and not exists (select 1 from loyalty_redemptions x where x.reward_id = r.id)`,
      [rewardId],
    )
    return result.rowCount > 0
  }
  return serializedWrite(async () => {
    const database = await readDatabase()
    if (database.redemptions.some((item) => item.reward_id === rewardId)) return false
    const index = database.rewards.findIndex((item) => item.id === rewardId)
    if (index < 0) return false
    database.rewards.splice(index, 1)
    await writeDatabase(database)
    return true
  })
}

export async function adjustPoints(customerId, points, description, adminId = 'admin') {
  const amount = Number.parseInt(points, 10)
  if (!amount) throw new Error('Informe uma quantidade de pontos.')
  if (!description?.trim()) throw new Error('Informe a justificativa do ajuste.')
  if (shouldUsePostgres()) {
    const client = await getPool().connect()
    try {
      await client.query('begin')
      await client.query(
        `insert into loyalty_accounts (customer_id) values ($1)
         on conflict (customer_id) do nothing`,
        [customerId],
      )
      const account = await client.query(
        'select current_balance from loyalty_accounts where customer_id = $1 for update',
        [customerId],
      )
      if (account.rows[0].current_balance + amount < 0) {
        throw new Error('O ajuste deixaria o saldo negativo.')
      }
      await client.query(
        `update loyalty_accounts set current_balance = current_balance + $2, updated_at = now()
         where customer_id = $1`,
        [customerId, amount],
      )
      await client.query(
        `insert into loyalty_transactions
          (id, customer_id, type, points, description, created_by)
         values ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), customerId, amount > 0 ? 'manual_credit' : 'manual_debit', amount, description, adminId],
      )
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
    return
  }
  return serializedWrite(async () => {
    const database = await readDatabase()
    const account = accountFor(database, customerId)
    if (account.current_balance + amount < 0) throw new Error('O ajuste deixaria o saldo negativo.')
    account.current_balance += amount
    account.updated_at = new Date().toISOString()
    database.transactions.push({
      id: randomUUID(), customer_id: customerId, order_id: null, reward_id: null,
      type: amount > 0 ? 'manual_credit' : 'manual_debit', points: amount,
      description, status: 'active', expires_at: null,
      created_at: new Date().toISOString(), created_by: adminId,
    })
    await writeDatabase(database)
  })
}
