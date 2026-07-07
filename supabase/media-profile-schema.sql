-- =========================================
-- Newsync 게시글 이미지 + 유저 프로필(인스타식)
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- (media 스토리지 버킷은 코드에서 이미 생성함)
-- =========================================

-- 게시글/뉴스 첨부 이미지 URL 목록
alter table public.community_posts
  add column if not exists images text[] not null default '{}';

-- 유저 프로필 (프로필 사진 / 대표 색상 / 소개)
alter table public.community_users
  add column if not exists avatar_url text,
  add column if not exists profile_color text,
  add column if not exists bio text;
