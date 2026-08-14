-- 아침 브리핑 메일 opt-in — Supabase SQL Editor에서 1회 실행.
alter table community_users
  add column if not exists brief_on boolean not null default false;
