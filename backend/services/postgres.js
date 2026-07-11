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

  migrationPromise ??= database.query(`
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

    create table if not exists catalog_state (
      key text primary key,
      data jsonb not null,
      updated_at timestamptz not null default now()
    );
  `)

  await migrationPromise
  return true
}

export async function query(text, params = []) {
  await migratePostgres()
  return getPool().query(text, params)
}
