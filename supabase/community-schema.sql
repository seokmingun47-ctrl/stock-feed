-- =========================================
-- Newsync 자유게시판(커뮤니티) 스키마
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요.
-- (shop 등 기존 테이블과 분리된 community_* 테이블만 추가합니다)
-- =========================================

-- 게시글
create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  title text not null,
  body text not null default '',
  tags text[] not null default '{}',
  views integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc);

-- 댓글
create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  nickname text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx
  on public.community_comments (post_id, created_at);

-- RLS 활성화 + 공개 정책 없음 → 익명/공개키 직접 접근 차단.
-- 모든 읽기/쓰기는 서버(secret key) API 경유로만.
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;

-- 조회수 원자적 증가 함수
create or replace function public.increment_post_views(p_id uuid)
returns void language sql as $$
  update public.community_posts set views = views + 1 where id = p_id;
$$;
