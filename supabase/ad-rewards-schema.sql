-- 광고 보상 크레딧. Supabase SQL Editor에서 1회 실행하세요.
-- 티켓 방식: 광고 시작 시 행을 만들고(claimed_at=null), 일정 시간이 지난 뒤에만 지급.
-- 서버가 시간을 재기 때문에 클라이언트가 "다 봤다"고 우겨도 즉시 받을 수 없습니다.
create table if not exists ad_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references community_users(id) on delete cascade,
  issued_at timestamptz not null default now(),
  claimed_at timestamptz,
  credits int not null default 0
);

-- 하루 지급 한도 조회용
create index if not exists ad_rewards_user_claimed_idx
  on ad_rewards(user_id, claimed_at);
