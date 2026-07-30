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
  order_id uuid references orders(id) on delete set null,
  reward_id text references loyalty_rewards(id) on delete set null,
  type text not null check (
    type in ('earn','redeem','reversal','expiration','manual_credit','manual_debit')
  ),
  points integer not null check (points <> 0),
  description text not null,
  status text not null default 'active',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by text not null
);

create unique index if not exists loyalty_one_earn_per_order_idx
  on loyalty_transactions (order_id)
  where type = 'earn';
create index if not exists loyalty_transactions_customer_idx
  on loyalty_transactions (customer_id, created_at desc);
create index if not exists loyalty_transactions_expires_idx
  on loyalty_transactions (expires_at)
  where status = 'active' and type = 'earn';

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

insert into loyalty_settings (key, data)
values (
  'main',
  '{"enabled":true,"points":1,"amount":1,"validityDays":365,"minimumOrder":0,"releaseStatus":"completed"}'::jsonb
)
on conflict (key) do nothing;

insert into loyalty_rewards (
  id, name, description, points_cost, stock, per_customer_limit, instructions
)
values (
  'brigadeiro-gratis',
  'Brigadeiro grátis',
  'Ganhe um brigadeiro artesanal no próximo pedido.',
  100,
  100,
  3,
  'Selecione o código no carrinho antes de finalizar.'
)
on conflict (id) do nothing;
