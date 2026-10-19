-- 번역 캐시 — Supabase SQL Editor 에서 1회 실행.
--
-- 왜 필요한가: 번역 캐시가 서버 인스턴스 메모리에만 있어서, 인스턴스가 바뀔 때마다
-- 같은 해외 기사를 처음부터 다시 번역했다. 그 호출량이 Gemini 무료 한도를 넘겨
-- 429 가 나고, 실패하면 영어 제목이 그대로 남았다.
-- 여기에 쌓아두면 한 번 번역한 문장은 다시 번역하지 않는다.
--
-- 이 표가 없어도 앱은 돌아간다(메모리 캐시로만 동작). 다만 번역 실패가 잦아진다.

create table if not exists translations (
  hash       text primary key,          -- sha256(원문). 본문 문단도 들어오므로 해시로 키를 잡는다.
  src        text not null,             -- 원문 앞 2000자 (디버깅·확인용)
  ko         text not null,             -- 한국어 번역
  created_at timestamptz not null default now()
);

-- 서버(secret key)만 읽고 쓴다. 브라우저에서 직접 접근할 일이 없다.
alter table translations enable row level security;

-- 오래된 캐시 정리가 필요할 때:
--   delete from translations where created_at < now() - interval '90 days';
create index if not exists translations_created_at_idx
  on translations (created_at);
