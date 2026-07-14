-- 이메일 회원가입 + 가입일. Supabase SQL Editor에서 1회 실행하세요.
alter table community_users
  add column if not exists email text;

alter table community_users
  add column if not exists created_at timestamptz default now();

-- 이메일 중복 방지 (대소문자 무시)
create unique index if not exists community_users_email_key
  on community_users (lower(email))
  where email is not null;
