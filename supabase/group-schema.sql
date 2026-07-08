-- =========================================
-- Newsync 그룹방(그룹 채팅)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- (community-schema / auth-schema 실행 후)
-- =========================================

-- 그룹방
create table if not exists public.group_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  emoji text,
  owner_id uuid references public.community_users(id) on delete set null,
  nickname text not null,
  last_body text,                       -- 목록 미리보기용(비정규화)
  last_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists group_rooms_lastat_idx
  on public.group_rooms (last_at desc nulls last, created_at desc);

-- 그룹 메시지
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.group_rooms(id) on delete cascade,
  user_id uuid references public.community_users(id) on delete set null,
  nickname text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists group_messages_room_idx
  on public.group_messages (room_id, created_at);

-- 그룹 멤버(참여 인원 카운트용)
create table if not exists public.group_members (
  room_id uuid not null references public.group_rooms(id) on delete cascade,
  user_id uuid not null references public.community_users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- RLS 활성화 + 공개 정책 없음 → 서버(secret key) API 경유로만 접근
alter table public.group_rooms enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_members enable row level security;
