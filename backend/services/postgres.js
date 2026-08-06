import pg from 'pg'

const { Pool } = pg

let pool
let migrationPromise

export function shouldUsePostgres() {
  return Boolean(process.env.DATABASE_URL)
}

export function getPool() {
  if (!shouldUsePostgres()) return null
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
  })
  return pool
}

export async function migratePostgres() {
  const database = getPool()
  if (!database) return false

  migrationPromise ??= (async () => {
    const client = await database.connect()
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock($1)', [1842202602])
      await client.query(`
    create table if not exists customers (
      id uuid primary key,
      name text not null,
      phone text not null unique,
      verified boolean not null default false,
      verified_at timestamptz,
      password_hash text,
      password_salt text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists orders (
      id uuid primary key,
      user_id uuid references customers(id) on delete set null,
      status text not null,
      restaurant_status text,
      payment_status text,
      payment_method text,
      payment_id text,
      status_detail text,
      payment_attempts integer not null default 0,
      order_data jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists orders_created_at_idx on orders (created_at desc);
    create index if not exists orders_user_id_idx on orders (user_id);
    create index if not exists orders_status_idx on orders (status);
    create index if not exists orders_user_completed_idx
      on orders (user_id, created_at desc)
      where restaurant_status = 'completed';

    create table if not exists customer_addresses (
      id uuid primary key,
      customer_id uuid not null references customers(id) on delete cascade,
      label text not null default 'Casa',
      recipient_name text not null,
      phone text not null,
      address text not null,
      number text not null,
      neighborhood text not null,
      complement text not null default '',
      fingerprint text not null,
      is_default boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (customer_id, fingerprint)
    );

    create index if not exists customer_addresses_customer_idx
      on customer_addresses (customer_id, is_default desc, updated_at desc);

    create table if not exists catalog_state (
      key text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists store_settings (
      key text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );

    create extension if not exists pgcrypto;

    create table if not exists loyalty_settings (
      key text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );

    create table if not exists loyalty_accounts (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid not null unique references customers(id) on delete cascade,
      current_balance integer not null default 0 check (current_balance >= 0),
      pending_balance integer not null default 0 check (pending_balance >= 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists loyalty_rewards (
      id text primary key,
      name text not null,
      description text not null default '',
      image_src text not null default '',
      points_cost integer not null check (points_cost > 0),
      active boolean not null default true,
      valid_from timestamptz,
      valid_until timestamptz,
      stock integer check (stock is null or stock >= 0),
      per_customer_limit integer not null default 1 check (per_customer_limit > 0),
      minimum_order numeric(12,2) not null default 0 check (minimum_order >= 0),
      product_id text,
      instructions text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists loyalty_transactions (
      id uuid primary key,
      customer_id uuid not null references customers(id) on delete cascade,
      order_id uuid,
      reward_id text references loyalty_rewards(id) on delete set null,
      type text not null check (type in ('earn','redeem','reversal','expiration','manual_credit','manual_debit')),
      points integer not null check (points <> 0),
      description text not null,
      status text not null default 'active',
      expires_at timestamptz,
      created_at timestamptz not null default now(),
      created_by text not null
    );

    create unique index if not exists loyalty_one_earn_per_order_idx
      on loyalty_transactions (order_id) where type = 'earn';
    create index if not exists loyalty_transactions_customer_idx
      on loyalty_transactions (customer_id, created_at desc);

    create table if not exists loyalty_redemptions (
      id uuid primary key,
      code text not null unique,
      customer_id uuid not null references customers(id) on delete cascade,
      reward_id text not null references loyalty_rewards(id) on delete restrict,
      points_used integer not null check (points_used > 0),
      status text not null default 'available'
        check (status in ('available','used','cancelled','restored')),
      order_id uuid references orders(id) on delete set null,
      created_at timestamptz not null default now(),
      used_at timestamptz
    );

    create index if not exists loyalty_redemptions_customer_idx
      on loyalty_redemptions (customer_id, created_at desc);

    create table if not exists campaigns (
      id text primary key,
      name text not null,
      type text not null default 'voucher',
      headline text not null default '',
      description text not null default '',
      benefit text not null default '',
      partner_name text not null default '',
      image_src text not null default '',
      instructions text not null default '',
      terms text not null default '',
      active boolean not null default true,
      start_at timestamptz,
      end_at timestamptz,
      code_prefix text not null default 'VALE',
      per_customer_limit integer not null default 1 check (per_customer_limit > 0),
      auto_distribute_completed_orders boolean not null default false,
      public_coupon_code text,
      discount_type text not null default 'fixed',
      discount_value numeric(12,2) not null default 0,
      minimum_order numeric(12,2) not null default 0,
      max_discount numeric(12,2),
      show_in_hero boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    alter table campaigns
      add column if not exists auto_distribute_completed_orders boolean
      not null default false;
    alter table campaigns add column if not exists public_coupon_code text;
    alter table campaigns add column if not exists discount_type text not null default 'fixed';
    alter table campaigns add column if not exists discount_value numeric(12,2) not null default 0;
    alter table campaigns add column if not exists minimum_order numeric(12,2) not null default 0;
    alter table campaigns add column if not exists max_discount numeric(12,2);
    alter table campaigns add column if not exists show_in_hero boolean not null default false;
    create unique index if not exists campaigns_public_coupon_code_idx
      on campaigns (upper(public_coupon_code))
      where public_coupon_code is not null and public_coupon_code <> '';

    create table if not exists campaign_vouchers (
      id uuid primary key,
      campaign_id text not null references campaigns(id) on delete cascade,
      customer_id uuid not null references customers(id) on delete cascade,
      code text not null unique,
      status text not null default 'available'
        check (status in ('available','used','cancelled')),
      source text not null default 'distributed',
      order_id uuid references orders(id) on delete set null,
      created_at timestamptz not null default now(),
      used_at timestamptz
    );

    create index if not exists campaign_vouchers_customer_idx
      on campaign_vouchers (customer_id, created_at desc);
    create index if not exists campaign_vouchers_campaign_idx
      on campaign_vouchers (campaign_id, created_at desc);
    create index if not exists campaign_vouchers_order_id_idx
      on campaign_vouchers (order_id)
      where order_id is not null;
    alter table campaign_vouchers add column if not exists source text not null default 'distributed';
    alter table campaign_vouchers add column if not exists order_id uuid;
    alter table campaign_vouchers
      drop constraint if exists campaign_vouchers_order_id_fkey;

    insert into loyalty_settings (key, data)
    values ('main', '{"enabled":true,"points":1,"amount":1,"validityDays":365,"minimumOrder":0,"releaseStatus":"completed"}'::jsonb)
    on conflict (key) do nothing;

    insert into loyalty_rewards
      (id, name, description, points_cost, stock, per_customer_limit, instructions)
    values
      ('brigadeiro-gratis', 'Brigadeiro grátis', 'Ganhe um brigadeiro artesanal no próximo pedido.', 100, 100, 3, 'Selecione o código no carrinho antes de finalizar.')
    on conflict (id) do nothing;
      `)
      await client.query('commit')
    } catch (error) {
      await client.query('rollback').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  })()

  await migrationPromise
  return true
}

export async function query(text, params = []) {
  await migratePostgres()
  return getPool().query(text, params)
}
