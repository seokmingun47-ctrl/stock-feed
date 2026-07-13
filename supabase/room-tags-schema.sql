-- 그룹방 태그: 방마다 경제·주식 관련 태그 1~5개 (검색/필터용)
-- Supabase SQL Editor에서 1회 실행하세요.

alter table group_rooms
  add column if not exists tags text[] default '{}';

-- 태그 검색 가속 (배열 GIN 인덱스)
create index if not exists group_rooms_tags_idx
  on group_rooms using gin (tags);
