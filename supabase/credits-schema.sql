-- AI 크레딧. Supabase SQL Editor에서 1회 실행하세요.
-- 기존 사용자도 기본 2000으로 채워집니다(default 백필).
alter table community_users
  add column if not exists credits int not null default 2000;

-- 원자적 차감(부족하면 -1). 음수 금액이면 환불(충전).
create or replace function spend_credits(p_user uuid, p_amount int)
returns int
language plpgsql
as $$
declare
  new_bal int;
begin
  update community_users
     set credits = credits - p_amount
   where id = p_user and credits >= p_amount
   returning credits into new_bal;
  if not found then
    return -1;
  end if;
  return new_bal;
end;
$$;
