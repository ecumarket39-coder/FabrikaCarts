create table if not exists wallets (
  user_id text primary key,
  credits integer not null default 0,
  bonus_granted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists credit_ledger (
  id text primary key,
  user_id text not null,
  delta integer not null,
  reason text not null,
  ref_type text not null,
  ref_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)
);

create index if not exists credit_ledger_user_idx on credit_ledger (user_id, created_at desc);

create table if not exists payments (
  id text primary key,
  user_id text not null,
  pack_id text not null,
  credits integer not null,
  amount_kopecks integer not null,
  currency text not null default 'RUB',
  method text not null,
  status text not null,
  idempotency_key text not null unique,
  provider text not null,
  provider_payment_id text,
  provider_status text,
  confirmation_url text,
  qr_payload text,
  description text not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_idx on payments (user_id, created_at desc);
create unique index if not exists payments_provider_pid_uidx
  on payments (provider, provider_payment_id)
  where provider_payment_id is not null;

create table if not exists receipts (
  id text primary key,
  payment_id text not null unique,
  user_id text not null,
  number text not null,
  payload_json text not null,
  created_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  payment_id text,
  payload_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists generation_jobs (
  id text primary key,
  user_id text not null,
  request_id text not null,
  status text not null,
  marketplace text not null,
  product_title text not null,
  product_notes text not null default '',
  category text not null default '',
  source_image_data text,
  result_json text,
  error text,
  credits_spent integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create index if not exists generation_jobs_user_idx on generation_jobs (user_id, created_at desc);

create table if not exists ops_events (
  id text primary key,
  level text not null,
  kind text not null,
  message text not null,
  payload_json text,
  created_at timestamptz not null default now()
);

create index if not exists ops_events_created_idx on ops_events (created_at desc);
