-- AI 크레딧. Supabase SQL Editor에서 1회 실행하세요.
-- 무료 플랜 기본 크레딧 1000 (신규 가입 지급액과 동일).
alter table community_users
  add column if not exists credits int not null default 1000;

-- 이미 컬럼이 있고 기본값만 1000으로 바꾸고 싶을 때:
alter table community_users alter column credits set default 1000;

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
