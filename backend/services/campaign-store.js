import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPool, shouldUsePostgres } from './postgres.js'
import { listUsers } from './user-store.js'

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url))
const defaultFile = path.resolve(serviceDirectory, '../data/campaigns.json')
let writeQueue = Promise.resolve()

function databaseFile() {
  return process.env.CAMPAIGNS_FILE
    ? path.resolve(process.env.CAMPAIGNS_FILE)
    : defaultFile
}

async function readDatabase() {
  try {
    const contents = await readFile(databaseFile(), 'utf8')
    const parsed = JSON.parse(contents)
    return {
      campaigns: Array.isArray(parsed.campaigns) ? parsed.campaigns : [],
      vouchers: Array.isArray(parsed.vouchers) ? parsed.vouchers : [],
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return { campaigns: [], vouchers: [] }
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

function voucherCode(prefix) {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`
}

function campaignFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    headline: row.headline,
    description: row.description,
    benefit: row.benefit,
    partnerName: row.partner_name,
    imageSrc: row.image_src,
    instructions: row.instructions,
    terms: row.terms,
    active: row.active,
    startAt: row.start_at,
    endAt: row.end_at,
    codePrefix: row.code_prefix,
    perCustomerLimit: Number(row.per_customer_limit),
    autoDistributeCompletedOrders:
      row.auto_distribute_completed_orders === true,
    publicCouponCode: row.public_coupon_code ?? '',
    discountType: row.discount_type ?? 'fixed',
    discountValue: Number(row.discount_value ?? 0),
    minimumOrder: Number(row.minimum_order ?? 0),
    maxDiscount:
      row.max_discount === null || row.max_discount === undefined
        ? null
        : Number(row.max_discount),
    showInHero: row.show_in_hero === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function voucherFromRow(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    code: row.code,
    status: row.status,
    source: row.source ?? 'distributed',
    orderId: row.order_id ?? null,
    createdAt: row.created_at,
    usedAt: row.used_at,
  }
}

export async function listAdminCampaigns() {
  if (shouldUsePostgres()) {
    const [campaigns, vouchers] = await Promise.all([
      getPool().query('select * from campaigns order by created_at desc'),
      getPool().query(
        `select v.*, c.name as customer_name, c.phone as customer_phone
         from campaign_vouchers v
         join customers c on c.id = v.customer_id
         order by v.created_at desc
         limit 500`,
      ),
    ])
    return {
      campaigns: campaigns.rows.map(campaignFromRow),
      vouchers: vouchers.rows.map(voucherFromRow),
    }
  }

  await writeQueue
  const [database, users] = await Promise.all([readDatabase(), listUsers()])
  const userMap = new Map(users.map((user) => [user.id, user]))
  return {
    campaigns: [...database.campaigns].sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt)),
    ),
    vouchers: [...database.vouchers]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 500)
      .map((voucher) => ({
        ...voucher,
        customerName: userMap.get(voucher.customerId)?.name ?? 'Cliente',
        customerPhone: userMap.get(voucher.customerId)?.phone ?? '',
      })),
  }
}

export async function listPublicCampaignHighlights() {
  const now = new Date()
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `select * from campaigns
       where active = true
         and show_in_hero = true
         and (start_at is null or start_at <= now())
         and (end_at is null or end_at >= now())
       order by updated_at desc
       limit 2`,
    )
    return result.rows.map(campaignFromRow)
  }

  await writeQueue
  const database = await readDatabase()
  return database.campaigns
    .filter(
      (campaign) =>
        campaign.active &&
        campaign.showInHero === true &&
        (!campaign.startAt || new Date(campaign.startAt) <= now) &&
        (!campaign.endAt || new Date(campaign.endAt) >= now),
    )
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, 2)
}

export async function countFeaturedCampaigns(excludeCampaignId = '') {
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `select count(*)::int as count
       from campaigns
       where active = true
         and show_in_hero = true
         and id <> $1`,
      [excludeCampaignId],
    )
    return result.rows[0].count
  }

  await writeQueue
  const database = await readDatabase()
  return database.campaigns.filter(
    (campaign) =>
      campaign.id !== excludeCampaignId &&
      campaign.active &&
      campaign.showInHero === true,
  ).length
}

export async function listCustomerCampaigns(customerId) {
  const now = new Date()
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `select v.*, row_to_json(c) as campaign
       from campaign_vouchers v
       join campaigns c on c.id = v.campaign_id
       where v.customer_id = $1
         and v.status <> 'cancelled'
         and c.active = true
         and (c.start_at is null or c.start_at <= now())
         and (c.end_at is null or c.end_at >= now())
       order by v.created_at desc`,
      [customerId],
    )
    return result.rows.map((row) => {
      const campaign = campaignFromRow(row.campaign)
      const voucher = voucherFromRow(row)
      return {
        voucher: {
          ...voucher,
          code:
            voucher.source === 'public' && campaign.publicCouponCode
              ? campaign.publicCouponCode
              : voucher.code,
        },
        campaign,
      }
    })
  }

  await writeQueue
  const database = await readDatabase()
  const campaigns = new Map(database.campaigns.map((item) => [item.id, item]))
  return database.vouchers
    .filter((voucher) => voucher.customerId === customerId && voucher.status !== 'cancelled')
    .flatMap((voucher) => {
      const campaign = campaigns.get(voucher.campaignId)
      if (
        !campaign?.active ||
        (campaign.startAt && new Date(campaign.startAt) > now) ||
        (campaign.endAt && new Date(campaign.endAt) < now)
      ) return []
      return [{
        voucher: {
          ...voucher,
          code:
            voucher.source === 'public' && campaign.publicCouponCode
              ? campaign.publicCouponCode
              : voucher.code,
        },
        campaign,
      }]
    })
    .sort((a, b) =>
      String(b.voucher.createdAt).localeCompare(String(a.voucher.createdAt)),
    )
}

export async function saveCampaign(campaignId, campaign) {
  const now = new Date().toISOString()
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `insert into campaigns
        (id,name,type,headline,description,benefit,partner_name,image_src,
         instructions,terms,active,start_at,end_at,code_prefix,per_customer_limit,
         auto_distribute_completed_orders,public_coupon_code,discount_type,
         discount_value,minimum_order,max_discount,show_in_hero)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       on conflict (id) do update set
         name=excluded.name,type=excluded.type,headline=excluded.headline,
         description=excluded.description,benefit=excluded.benefit,
         partner_name=excluded.partner_name,image_src=excluded.image_src,
         instructions=excluded.instructions,terms=excluded.terms,
         active=excluded.active,start_at=excluded.start_at,end_at=excluded.end_at,
         code_prefix=excluded.code_prefix,per_customer_limit=excluded.per_customer_limit,
         auto_distribute_completed_orders=excluded.auto_distribute_completed_orders,
         public_coupon_code=excluded.public_coupon_code,
         discount_type=excluded.discount_type,
         discount_value=excluded.discount_value,
         minimum_order=excluded.minimum_order,
         max_discount=excluded.max_discount,
         show_in_hero=excluded.show_in_hero,
         updated_at=now()
       returning *`,
      [
        campaignId, campaign.name, campaign.type, campaign.headline,
        campaign.description, campaign.benefit, campaign.partnerName,
        campaign.imageSrc, campaign.instructions, campaign.terms,
        campaign.active, campaign.startAt || null, campaign.endAt || null,
        campaign.codePrefix, campaign.perCustomerLimit,
        campaign.autoDistributeCompletedOrders,
        campaign.publicCouponCode || null, campaign.discountType,
        campaign.discountValue, campaign.minimumOrder, campaign.maxDiscount,
        campaign.showInHero,
      ],
    )
    return campaignFromRow(result.rows[0])
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const index = database.campaigns.findIndex((item) => item.id === campaignId)
    const previous = index >= 0 ? database.campaigns[index] : null
    const saved = {
      ...campaign,
      id: campaignId,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }
    if (index >= 0) database.campaigns[index] = saved
    else database.campaigns.push(saved)
    await writeDatabase(database)
    return saved
  })
}

export async function deleteCampaign(campaignId) {
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `delete from campaigns c
       where c.id = $1
         and not exists (
           select 1 from campaign_vouchers v where v.campaign_id = c.id
         )`,
      [campaignId],
    )
    return result.rowCount > 0
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    if (database.vouchers.some((item) => item.campaignId === campaignId)) {
      return false
    }
    const index = database.campaigns.findIndex((item) => item.id === campaignId)
    if (index < 0) return false
    database.campaigns.splice(index, 1)
    await writeDatabase(database)
    return true
  })
}

export async function distributeCampaign(campaignId, customerIds) {
  const uniqueCustomerIds = [...new Set(customerIds)]
  if (!uniqueCustomerIds.length) return []

  if (shouldUsePostgres()) {
    const client = await getPool().connect()
    try {
      await client.query('begin')
      const campaignResult = await client.query(
        'select * from campaigns where id = $1 for update',
        [campaignId],
      )
      const campaign = campaignResult.rows[0]
      if (!campaign?.active) throw new Error('Esta campanha não está ativa.')
      const created = []
      for (const customerId of uniqueCustomerIds) {
        const count = await client.query(
          `select count(*)::int as count from campaign_vouchers
           where campaign_id = $1 and customer_id = $2 and status <> 'cancelled'`,
          [campaignId, customerId],
        )
        if (count.rows[0].count >= campaign.per_customer_limit) continue
        const voucher = {
          id: randomUUID(),
          campaignId,
          customerId,
          code: voucherCode(campaign.code_prefix),
        }
        await client.query(
          `insert into campaign_vouchers
            (id,campaign_id,customer_id,code)
           values ($1,$2,$3,$4)`,
          [voucher.id, campaignId, customerId, voucher.code],
        )
        created.push(voucher)
      }
      await client.query('commit')
      return created
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const campaign = database.campaigns.find((item) => item.id === campaignId)
    if (!campaign?.active) throw new Error('Esta campanha não está ativa.')
    const created = []
    for (const customerId of uniqueCustomerIds) {
      const count = database.vouchers.filter(
        (item) =>
          item.campaignId === campaignId &&
          item.customerId === customerId &&
          item.status !== 'cancelled',
      ).length
      if (count >= campaign.perCustomerLimit) continue
      const voucher = {
        id: randomUUID(),
        campaignId,
        customerId,
        code: voucherCode(campaign.codePrefix),
        status: 'available',
        source: 'distributed',
        orderId: null,
        createdAt: new Date().toISOString(),
        usedAt: null,
      }
      database.vouchers.push(voucher)
      created.push(voucher)
    }
    await writeDatabase(database)
    return created
  })
}

export async function updateVoucherStatus(voucherId, status) {
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `update campaign_vouchers
       set status = $2, used_at = case when $2 = 'used' then now() else null end
       where id = $1
       returning *`,
      [voucherId, status],
    )
    return result.rows[0] ? voucherFromRow(result.rows[0]) : null
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const voucher = database.vouchers.find((item) => item.id === voucherId)
    if (!voucher) return null
    voucher.status = status
    voucher.usedAt = status === 'used' ? new Date().toISOString() : null
    await writeDatabase(database)
    return voucher
  })
}

export async function processCompletedOrderCampaigns(order) {
  if (
    order?.restaurant_status !== 'completed' ||
    !order.user_id
  ) return 0

  const now = new Date()
  let campaignIds
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `select id from campaigns
       where active = true
         and auto_distribute_completed_orders = true
         and (start_at is null or start_at <= now())
         and (end_at is null or end_at >= now())`,
    )
    campaignIds = result.rows.map((row) => row.id)
  } else {
    await writeQueue
    const database = await readDatabase()
    campaignIds = database.campaigns
      .filter(
        (campaign) =>
          campaign.active &&
          campaign.autoDistributeCompletedOrders &&
          (!campaign.startAt || new Date(campaign.startAt) <= now) &&
          (!campaign.endAt || new Date(campaign.endAt) >= now),
      )
      .map((campaign) => campaign.id)
  }

  let distributed = 0
  for (const campaignId of campaignIds) {
    distributed += (await distributeCampaign(campaignId, [order.user_id])).length
  }
  return distributed
}

function toMoney(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 0
  return Math.round(number * 100) / 100
}

function validateCouponCampaign(campaign, subtotal, deliveryFee) {
  const now = new Date()
  if (!campaign || campaign.type !== 'coupon') {
    throw new Error('Este código não é um cupom de desconto.')
  }
  if (
    !campaign.active ||
    (campaign.startAt && new Date(campaign.startAt) > now) ||
    (campaign.endAt && new Date(campaign.endAt) < now)
  ) {
    throw new Error('Este cupom não está ativo ou está fora da validade.')
  }

  const productsSubtotal = toMoney(subtotal)
  const shipping = toMoney(deliveryFee)
  if (productsSubtotal < toMoney(campaign.minimumOrder)) {
    const missing = toMoney(campaign.minimumOrder - productsSubtotal)
    throw new Error(
      `Faltam R$ ${missing.toFixed(2).replace('.', ',')} em produtos para usar este cupom.`,
    )
  }

  let discount = 0
  if (campaign.discountType === 'percentage') {
    discount = productsSubtotal * (toMoney(campaign.discountValue) / 100)
    if (campaign.maxDiscount !== null && campaign.maxDiscount !== undefined) {
      discount = Math.min(discount, toMoney(campaign.maxDiscount))
    }
  } else if (campaign.discountType === 'free_delivery') {
    discount = shipping
  } else {
    discount = toMoney(campaign.discountValue)
  }
  discount = toMoney(Math.min(discount, productsSubtotal + shipping))
  if (discount <= 0) {
    throw new Error('Este cupom não gera desconto para o pedido atual.')
  }
  return discount
}

function couponResult(campaign, code, discount, voucherId = null) {
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    code,
    discount,
    discountType: campaign.discountType,
    voucherId,
  }
}

async function resolvePostgresCoupon(client, customerId, code, lock = false) {
  const suffix = lock ? ' for update of v, c' : ''
  const assigned = await client.query(
    `select v.*, row_to_json(c) as campaign
     from campaign_vouchers v
     join campaigns c on c.id = v.campaign_id
     where upper(v.code) = upper($1) and v.customer_id = $2
     ${suffix}`,
    [code, customerId],
  )
  if (assigned.rows[0]) {
    return {
      kind: 'assigned',
      voucher: assigned.rows[0],
      campaign: campaignFromRow(assigned.rows[0].campaign),
    }
  }

  const publicCampaign = await client.query(
    `select * from campaigns
     where upper(public_coupon_code) = upper($1)
     ${lock ? 'for update' : ''}`,
    [code],
  )
  if (!publicCampaign.rows[0]) return null
  return {
    kind: 'public',
    voucher: null,
    campaign: campaignFromRow(publicCampaign.rows[0]),
  }
}

async function ensurePublicCouponLimit(client, campaign, customerId) {
  const result = await client.query(
    `select count(*)::int as count
     from campaign_vouchers
     where campaign_id = $1
       and customer_id = $2
       and status = 'used'`,
    [campaign.id, customerId],
  )
  if (result.rows[0].count >= campaign.perCustomerLimit) {
    throw new Error('Você já atingiu o limite de uso deste cupom.')
  }
}

export async function previewCampaignCoupon(
  customerId,
  rawCode,
  subtotal,
  deliveryFee,
) {
  const code = String(rawCode ?? '').trim().toUpperCase()
  if (!code) throw new Error('Informe o código do cupom.')

  if (shouldUsePostgres()) {
    const resolved = await resolvePostgresCoupon(
      getPool(),
      customerId,
      code,
    )
    if (!resolved) throw new Error('Cupom não encontrado.')
    if (resolved.kind === 'assigned' && resolved.voucher.status !== 'available') {
      throw new Error('Este cupom já foi utilizado ou está indisponível.')
    }
    if (resolved.kind === 'public') {
      await ensurePublicCouponLimit(getPool(), resolved.campaign, customerId)
    }
    const discount = validateCouponCampaign(
      resolved.campaign,
      subtotal,
      deliveryFee,
    )
    return couponResult(
      resolved.campaign,
      code,
      discount,
      resolved.voucher?.id ?? null,
    )
  }

  await writeQueue
  const database = await readDatabase()
  const assigned = database.vouchers.find(
    (voucher) =>
      voucher.customerId === customerId &&
      String(voucher.code).toUpperCase() === code,
  )
  const campaign = assigned
    ? database.campaigns.find((item) => item.id === assigned.campaignId)
    : database.campaigns.find(
        (item) => String(item.publicCouponCode ?? '').toUpperCase() === code,
      )
  if (!campaign) throw new Error('Cupom não encontrado.')
  if (assigned && assigned.status !== 'available') {
    throw new Error('Este cupom já foi utilizado ou está indisponível.')
  }
  if (!assigned) {
    const usedCount = database.vouchers.filter(
      (voucher) =>
        voucher.campaignId === campaign.id &&
        voucher.customerId === customerId &&
        voucher.status === 'used',
    ).length
    if (usedCount >= campaign.perCustomerLimit) {
      throw new Error('Você já atingiu o limite de uso deste cupom.')
    }
  }
  const discount = validateCouponCampaign(campaign, subtotal, deliveryFee)
  return couponResult(campaign, code, discount, assigned?.id ?? null)
}

export async function claimCampaignCoupon({
  customerId,
  code: rawCode,
  subtotal,
  deliveryFee,
  orderId,
}) {
  const code = String(rawCode ?? '').trim().toUpperCase()
  if (!code) return null

  if (shouldUsePostgres()) {
    const client = await getPool().connect()
    try {
      await client.query('begin')
      const resolved = await resolvePostgresCoupon(
        client,
        customerId,
        code,
        true,
      )
      if (!resolved) throw new Error('Cupom não encontrado.')
      const discount = validateCouponCampaign(
        resolved.campaign,
        subtotal,
        deliveryFee,
      )
      let voucherId
      if (resolved.kind === 'assigned') {
        if (resolved.voucher.status !== 'available') {
          throw new Error('Este cupom já foi utilizado ou está indisponível.')
        }
        voucherId = resolved.voucher.id
        await client.query(
          `update campaign_vouchers
           set status = 'used', source = coalesce(source, 'distributed'),
               order_id = $2, used_at = now()
           where id = $1`,
          [voucherId, orderId],
        )
      } else {
        await ensurePublicCouponLimit(
          client,
          resolved.campaign,
          customerId,
        )
        voucherId = randomUUID()
        await client.query(
          `insert into campaign_vouchers
            (id,campaign_id,customer_id,code,status,source,order_id,used_at)
           values ($1,$2,$3,$4,'used','public',$5,now())`,
          [
            voucherId,
            resolved.campaign.id,
            customerId,
            voucherCode(resolved.campaign.codePrefix),
            orderId,
          ],
        )
      }
      await client.query('commit')
      return couponResult(
        resolved.campaign,
        code,
        discount,
        voucherId,
      )
    } catch (error) {
      await client.query('rollback')
      throw error
    } finally {
      client.release()
    }
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    const assigned = database.vouchers.find(
      (voucher) =>
        voucher.customerId === customerId &&
        String(voucher.code).toUpperCase() === code,
    )
    const campaign = assigned
      ? database.campaigns.find((item) => item.id === assigned.campaignId)
      : database.campaigns.find(
          (item) => String(item.publicCouponCode ?? '').toUpperCase() === code,
        )
    if (!campaign) throw new Error('Cupom não encontrado.')
    const discount = validateCouponCampaign(campaign, subtotal, deliveryFee)
    let voucher
    if (assigned) {
      if (assigned.status !== 'available') {
        throw new Error('Este cupom já foi utilizado ou está indisponível.')
      }
      voucher = assigned
      voucher.status = 'used'
      voucher.orderId = orderId
      voucher.usedAt = new Date().toISOString()
    } else {
      const usedCount = database.vouchers.filter(
        (item) =>
          item.campaignId === campaign.id &&
          item.customerId === customerId &&
          item.status === 'used',
      ).length
      if (usedCount >= campaign.perCustomerLimit) {
        throw new Error('Você já atingiu o limite de uso deste cupom.')
      }
      voucher = {
        id: randomUUID(),
        campaignId: campaign.id,
        customerId,
        code: voucherCode(campaign.codePrefix),
        status: 'used',
        source: 'public',
        orderId,
        createdAt: new Date().toISOString(),
        usedAt: new Date().toISOString(),
      }
      database.vouchers.push(voucher)
    }
    await writeDatabase(database)
    return couponResult(campaign, code, discount, voucher.id)
  })
}

export async function releaseCampaignCouponForOrder(orderId) {
  if (!orderId) return 0
  if (shouldUsePostgres()) {
    const result = await getPool().query(
      `update campaign_vouchers
       set status = case when source = 'public' then 'cancelled' else 'available' end,
           order_id = null,
           used_at = null
       where order_id = $1 and status = 'used'`,
      [orderId],
    )
    return result.rowCount
  }

  return serializedWrite(async () => {
    const database = await readDatabase()
    let released = 0
    for (const voucher of database.vouchers) {
      if (voucher.orderId !== orderId || voucher.status !== 'used') continue
      voucher.status = voucher.source === 'public' ? 'cancelled' : 'available'
      voucher.orderId = null
      voucher.usedAt = null
      released += 1
    }
    if (released) await writeDatabase(database)
    return released
  })
}

export async function resetCampaignsForTests() {
  if (shouldUsePostgres()) {
    await getPool().query('delete from campaign_vouchers; delete from campaigns;')
    return
  }
  return serializedWrite(() => writeDatabase({ campaigns: [], vouchers: [] }))
}
