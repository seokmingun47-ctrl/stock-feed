-- 프로 + 정기결제(구독) 전체 스키마. Supabase SQL Editor에서 이 블록 전체를 1회 Run 하세요.

-- 1) 프로 여부 (결제 성공 시 true)
alter table community_users
  add column if not exists is_pro boolean not null default false;

-- 2) 구독 (빌링키 기반 자동결제)
create table if not exists subscriptions (
  user_id uuid primary key references community_users(id) on delete cascade,
  customer_key text not null,
  billing_key text not null,
  status text not null default 'active',      -- active | canceled | past_due
  amount int not null default 4900,
  last_charged_at timestamptz,
  next_charge_at timestamptz not null,
  fail_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_due_idx
  on subscriptions(status, next_charge_at);

-- 3) 결제 기록
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references community_users(id) on delete set null,
  order_id text not null,
  payment_key text,
  amount int not null,
  kind text not null default 'subscription',  -- subscription | renewal
  status text not null default 'DONE',
  created_at timestamptz not null default now()
);
create index if not exists payments_user_idx on payments(user_id, created_at desc);
create unique index if not exists payments_order_uq on payments(order_id);
