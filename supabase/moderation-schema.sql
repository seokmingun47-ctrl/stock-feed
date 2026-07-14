-- 신고/차단 (앱스토어 UGC 규정). Supabase SQL Editor에서 1회 실행하세요.

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references community_users(id) on delete set null,
  target_type text not null,            -- post | comment | message | user | news
  target_id text not null,
  reason text not null,
  note text,
  status text not null default 'pending', -- pending | resolved
  created_at timestamptz default now()
);
create index if not exists reports_status_idx on reports (status, created_at desc);

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid references community_users(id) on delete cascade,
  blocked_id uuid references community_users(id) on delete cascade,
  created_at timestamptz default now(),
  unique (blocker_id, blocked_id)
);
create index if not exists blocks_blocker_idx on blocks (blocker_id);
