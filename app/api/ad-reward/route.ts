import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { spendCredits, getCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 광고 1회 시청 보상 = AI 1회분(AI_COST=25).
// ⚠️ 이보다 후하게 주면 적자다 — 보상형 광고는 클릭이 거의 안 나서 노출 수익(1원 안팎)만
//    들어오는데, AI 1회 호출 비용이 그보다 크기 때문. 올릴 때는 실제 청구액을 먼저 볼 것.
export const AD_REWARD_CREDITS = 25;
// 서버가 재는 최소 시청 시간 — 클라이언트 타이머는 못 믿는다
const MIN_WATCH_SEC = 15;
// 하루 최대 지급 횟수 (무한 획득 방지)
const DAILY_LIMIT = 5;

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// GET: 남은 횟수 조회 (모달에 표시)
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, remaining: DAILY_LIMIT, reward: AD_REWARD_CREDITS });
  }
  const db = getAdminClient();
  // ⚠️ 두 가지 함정:
  //   1) supabase-js는 에러를 throw하지 않고 error 필드로 준다 → try/catch로는 못 잡는다.
  //   2) head:true(HEAD 요청)는 본문이 없어 "테이블 없음"이 204로 둔갑한다.
  //      그러면 count=null → used=0 → "10번 가능"이라 거짓 안내하게 된다. head를 쓰지 말 것.
  //      (하루 최대 DAILY_LIMIT행이라 실제로 받아와도 부담 없음)
  const { count, error } = await db
    .from("ad_rewards")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)
    .not("claimed_at", "is", null)
    .gte("claimed_at", startOfTodayIso());
  if (error) {
    return NextResponse.json({ ok: false, reason: "not-ready" }, { status: 503 });
  }
  const used = count ?? 0;
  return NextResponse.json({
    ok: true,
    remaining: Math.max(0, DAILY_LIMIT - used),
    limit: DAILY_LIMIT,
    reward: AD_REWARD_CREDITS,
  });
}

export async function POST(req: NextRequest) {
  let body: { action?: unknown; ticket?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const action = String(body.action ?? "");

  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  }
  // 프로는 크레딧이 넉넉해 광고를 볼 이유가 없음
  if (user.isPro) {
    return NextResponse.json(
      { ok: false, reason: "프로는 광고 없이 이용할 수 있어요." },
      { status: 400 },
    );
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const db = getAdminClient();

  // 오늘 지급 횟수 확인 (head:true 금지 — 위 GET 주석 참고)
  const { count, error: countErr } = await db
    .from("ad_rewards")
    .select("id", { count: "exact" })
    .eq("user_id", user.id)
    .not("claimed_at", "is", null)
    .gte("claimed_at", startOfTodayIso());
  if (countErr) {
    return NextResponse.json(
      { ok: false, reason: "광고 보상 기능이 아직 준비되지 않았어요.", code: "NOT_READY" },
      { status: 503 },
    );
  }
  const used = count ?? 0;
  if (used >= DAILY_LIMIT) {
    return NextResponse.json(
      {
        ok: false,
        code: "DAILY_LIMIT",
        reason: `오늘은 광고 보상을 ${DAILY_LIMIT}번 모두 받았어요. 내일 다시 이용해 주세요.`,
      },
      { status: 429 },
    );
  }

  // 1) 광고 시작 — 티켓 발급
  if (action === "start") {
    const { data, error } = await db
      .from("ad_rewards")
      .insert({ user_id: user.id })
      .select("id")
      .single();
    if (error || !data) {
      return NextResponse.json({ ok: false, reason: "광고를 준비하지 못했어요." }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      ticket: data.id,
      watchSeconds: MIN_WATCH_SEC,
      reward: AD_REWARD_CREDITS,
    });
  }

  // 2) 시청 완료 — 서버가 경과 시간을 검증하고 지급
  if (action === "claim") {
    const ticket = String(body.ticket ?? "");
    if (!ticket) {
      return NextResponse.json({ ok: false, reason: "티켓이 없어요." }, { status: 400 });
    }
    const { data: row } = await db
      .from("ad_rewards")
      .select("id, user_id, issued_at, claimed_at")
      .eq("id", ticket)
      .maybeSingle();

    if (!row || row.user_id !== user.id) {
      return NextResponse.json({ ok: false, reason: "잘못된 티켓이에요." }, { status: 400 });
    }
    if (row.claimed_at) {
      return NextResponse.json(
        { ok: false, reason: "이미 지급된 광고예요.", code: "ALREADY" },
        { status: 409 },
      );
    }
    const elapsed = (Date.now() - new Date(row.issued_at as string).getTime()) / 1000;
    if (elapsed < MIN_WATCH_SEC - 1) {
      return NextResponse.json(
        { ok: false, reason: "광고를 끝까지 시청해 주세요.", code: "TOO_SOON" },
        { status: 400 },
      );
    }

    // 지급 확정 (claimed_at이 아직 null인 행만 갱신 → 동시 요청 중복 지급 방지)
    const { data: updated } = await db
      .from("ad_rewards")
      .update({ claimed_at: new Date().toISOString(), credits: AD_REWARD_CREDITS })
      .eq("id", ticket)
      .is("claimed_at", null)
      .select("id")
      .maybeSingle();
    if (!updated) {
      return NextResponse.json(
        { ok: false, reason: "이미 지급된 광고예요.", code: "ALREADY" },
        { status: 409 },
      );
    }

    // 음수 = 충전
    await spendCredits(db, user.id, -AD_REWARD_CREDITS);
    const bal = await getCredits(db, user.id);
    return NextResponse.json({
      ok: true,
      granted: AD_REWARD_CREDITS,
      credits: Number.isNaN(bal) ? null : bal,
      remaining: Math.max(0, DAILY_LIMIT - (used + 1)),
    });
  }

  return NextResponse.json({ ok: false, reason: "bad-action" }, { status: 400 });
}
