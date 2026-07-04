-- =========================================
-- Newsync 유저 뉴스 + 팔로우
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- (community-schema / auth-schema / features-schema 실행 후)
-- =========================================

-- 글 종류: 'post'(자유글) | 'news'(유저 뉴스)
alter table public.community_posts
  add column if not exists kind text not null default 'post';
create index if not exists community_posts_kind_idx
  on public.community_posts (kind, created_at desc);

-- 팔로우 (유저 → 유저). 팔로우하면 그 유저의 뉴스만 모아볼 수 있음.
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.community_users(id) on delete cascade,
  author_id  uuid not null references public.community_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, author_id)
);
create index if not exists follows_follower_idx on public.follows (follower_id, created_at);
create index if not exists follows_author_idx on public.follows (author_id);

-- RLS 활성화 + 공개 정책 없음 → 서버(secret key) API 경유로만 접근.
alter table public.follows enable row level security;
