-- 프로 구독 여부. Supabase SQL Editor에서 1회 실행하세요.
-- (결제는 앱 정식 출시 후 연동. 그때 구매 시 is_pro=true 설정)
alter table community_users
  add column if not exists is_pro boolean not null default false;
