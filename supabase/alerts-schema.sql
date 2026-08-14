-- 실시간 알림(프로) — Supabase SQL Editor에서 1회 실행.

-- 1) 관심종목을 서버에 저장(크론이 각 유저의 관심종목을 알아야 알림을 보냄).
--    alerts_on: 알림 켬 여부, alert_state: 중복 알림 방지용 마지막 상태.
alter table community_users
  add column if not exists watchlist   jsonb   not null default '[]'::jsonb,
  add column if not exists alerts_on   boolean not null default false,
  add column if not exists alert_state jsonb   not null default '{}'::jsonb;

-- 2) 웹푸시 구독 정보(기기별 1행). 같은 기기 재구독 시 upsert.
create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references community_users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);
