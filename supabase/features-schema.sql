-- =========================================
-- Newsync 좋아요 + 뉴스 댓글 + 인기
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- (community-schema.sql, auth-schema.sql 실행 후)
-- =========================================

-- 좋아요 (글 'post' / 뉴스 'news' 공용)
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.community_users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'news')),
  target_id text not null,             -- 글 uuid 또는 뉴스 url
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);
create index if not exists likes_target_idx on public.likes (target_type, target_id);
alter table public.likes enable row level security;

-- 글 좋아요 수 (비정규화 — 인기 정렬용)
alter table public.community_posts
  add column if not exists like_count integer not null default 0;

-- 뉴스 항목 (좋아요/댓글이 달린 뉴스만 저장 → 인기 뉴스 표시용)
create table if not exists public.news_items (
  url text primary key,
  title text not null default '',
  source_id text not null default '',
  image text,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.news_items enable row level security;

-- 뉴스 댓글
create table if not exists public.news_comments (
  id uuid primary key default gen_random_uuid(),
  article_url text not null,
  user_id uuid references public.community_users(id) on delete set null,
  nickname text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists news_comments_url_idx
  on public.news_comments (article_url, created_at);
alter table public.news_comments enable row level security;

-- 카운터 증감 RPC (음수 방지)
create or replace function public.bump_post_likes(p_id uuid, d int)
returns void language sql as $$
  update public.community_posts set like_count = greatest(0, like_count + d) where id = p_id;
$$;
create or replace function public.bump_news_likes(p_url text, d int)
returns void language sql as $$
  update public.news_items set like_count = greatest(0, like_count + d) where url = p_url;
$$;
create or replace function public.bump_news_comments(p_url text, d int)
returns void language sql as $$
  update public.news_items set comment_count = greatest(0, comment_count + d) where url = p_url;
$$;
