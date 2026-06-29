-- =========================================
-- Newsync 회원(아이디/비밀번호) + 작성자 연결
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- (community-schema.sql 을 먼저 실행한 상태여야 합니다)
-- =========================================

-- 회원
create table if not exists public.community_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.community_users enable row level security;
-- 공개 정책 없음 → 서버(secret key)만 접근

-- 글/댓글에 작성자(회원) 연결 — 본인 글 삭제 판별용
alter table public.community_posts
  add column if not exists user_id uuid references public.community_users(id) on delete set null;
alter table public.community_comments
  add column if not exists user_id uuid references public.community_users(id) on delete set null;
