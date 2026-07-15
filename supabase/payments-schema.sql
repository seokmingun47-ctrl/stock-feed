-- 결제 기록 (선택). Supabase SQL Editor에서 1회 실행하세요.
-- 미실행이어도 결제/승인은 동작하고, 기록만 남지 않습니다.
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references community_users(id) on delete set null,
  order_id text not null,
  payment_key text,
  amount int not null,
  status text not null default 'DONE',
  created_at timestamptz not null default now()
);
create index if not exists payments_user_idx on payments(user_id, created_at desc);
create unique index if not exists payments_order_uq on payments(order_id);
