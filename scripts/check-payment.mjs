/**
 * 결제 설정 점검 스크립트.
 *
 *   node scripts/check-payment.mjs            → 로컬(.env.local) 점검
 *   node scripts/check-payment.mjs --prod     → 프로덕션(newsync.app) 점검
 *
 * 토스 키를 실제 키로 바꾼 뒤 이걸 돌려서 전부 ✅ 인지 확인하세요.
 */
import { readFileSync } from "node:fs";

const PROD = process.argv.includes("--prod");
const SITE = "https://newsync.app";

// .env.local 읽기 (로컬 점검용)
const env = {};
try {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* 없으면 프로덕션 점검만 */
}

const ok = (s) => `✅ ${s}`;
const no = (s) => `❌ ${s}`;
const warn = (s) => `⚠️  ${s}`;
let problems = 0;

console.log(`\n━━━ 결제 설정 점검 (${PROD ? "프로덕션" : "로컬"}) ━━━\n`);

/* 1) 키 존재와 짝 맞춤 --------------------------------------------------- */
if (!PROD) {
  const client = env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
  const secret = env.TOSS_SECRET_KEY || "";

  if (!client && !secret) {
    console.log(warn("토스 키 미설정 — 테스트 키로 동작합니다(실제 청구 없음)."));
  } else if (!client || !secret) {
    console.log(no(`키가 한쪽만 설정됨: ${!client ? "클라이언트 키 없음" : "시크릿 키 없음"}`));
    problems++;
  } else {
    const cLive = client.startsWith("live_");
    const sLive = secret.startsWith("live_");
    if (cLive !== sLive) {
      console.log(no("클라이언트 키와 시크릿 키의 모드(test/live)가 다릅니다."));
      problems++;
    } else {
      console.log(ok(`토스 키 짝 일치 — ${cLive ? "실제 결제(live)" : "테스트(test)"} 모드`));
      if (!cLive) console.log(warn("아직 테스트 키입니다. 실제 청구가 되지 않습니다."));
    }
  }

  if (!env.CRON_SECRET) {
    console.log(warn("CRON_SECRET 미설정 — 자동갱신 엔드포인트가 무인증으로 열립니다."));
  } else {
    console.log(ok("CRON_SECRET 설정됨 (자동갱신 보호)"));
  }
}

/* 2) 프로덕션 응답 확인 -------------------------------------------------- */
const check = async (path, expect, label) => {
  try {
    const r = await fetch(SITE + path, { redirect: "manual" });
    const good = expect.includes(r.status);
    console.log(good ? ok(`${label} (${r.status})`) : no(`${label} — ${r.status} 예상:${expect}`));
    if (!good) problems++;
  } catch (e) {
    console.log(no(`${label} — 요청 실패: ${e.message}`));
    problems++;
  }
};

if (PROD) {
  await check("/pricing", [200], "요금제 페이지");
  await check("/checkout", [200], "결제 페이지");
  // 크론은 비밀키 없이 부르면 401이어야 정상(보호되고 있다는 뜻)
  await check("/api/billing/renew", [401, 503], "자동갱신 크론 인증 보호");
}

/* 3) 결과 ---------------------------------------------------------------- */
console.log(
  problems === 0
    ? "\n결과: 문제 없음\n"
    : `\n결과: 문제 ${problems}건 — 위 ❌ 항목을 고쳐야 실제 결제가 정상 동작합니다.\n`,
);
process.exit(problems === 0 ? 0 : 1);
