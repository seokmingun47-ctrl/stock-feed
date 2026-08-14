import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { addCredits, setCredits, getCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 관리자 전용: 가입자 목록 (최근 가입순, 크레딧 포함)
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const me = await getUser(req);
  if (!me || !me.isAdmin) {
    return NextResponse.json({ ok: false, reason: "관리자만 볼 수 있어요." }, { status: 403 });
  }

  const db = getAdminClient();
  let rows: Record<string, unknown>[] = [];
  // credits/email/created_at 컬럼이 없을 수도 있어 단계적으로 폴백
  const full = await db
    .from("community_users")
    .select("id, username, email, created_at, credits")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (full.error) {
    const mid = await db
      .from("community_users")
      .select("id, username, email, created_at")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (mid.error) {
      const basic = await db.from("community_users").select("id, username").limit(1000);
      rows = (basic.data ?? []) as Record<string, unknown>[];
    } else {
      rows = (mid.data ?? []) as Record<string, unknown>[];
    }
  } else {
    rows = (full.data ?? []) as Record<string, unknown>[];
  }

  const users = rows.map((r) => ({
    id: String(r.id),
    username: String(r.username ?? ""),
    email: (r.email as string) ?? null,
    createdAt: r.created_at ? Date.parse(String(r.created_at)) : 0,
    credits: r.credits === undefined || r.credits === null ? null : Number(r.credits),
  }));

  return NextResponse.json({ ok: true, users, total: users.length });
}

// 관리자 전용: 특정 가입자에게 크레딧 지급/설정
//  body: { userId, add }  → 현재 잔액에 add 만큼 더함(음수면 차감)
//        { userId, set }  → 절대값으로 설정
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const me = await getUser(req);
  if (!me || !me.isAdmin) {
    return NextResponse.json({ ok: false, reason: "관리자만 가능해요." }, { status: 403 });
  }

  let body: { userId?: unknown; add?: unknown; set?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  if (!userId) {
    return NextResponse.json({ ok: false, reason: "대상 사용자가 없어요." }, { status: 400 });
  }
  const hasSet = body.set !== undefined && body.set !== null;
  const amount = Number(hasSet ? body.set : body.add);
  if (!Number.isFinite(amount)) {
    return NextResponse.json({ ok: false, reason: "지급할 크레딧 값이 올바르지 않아요." }, { status: 400 });
  }
  // 안전 상한 (오조작 방지)
  if (Math.abs(amount) > 1_000_000) {
    return NextResponse.json({ ok: false, reason: "한 번에 100만까지만 처리해요." }, { status: 400 });
  }

  const db = getAdminClient();
  const bal = hasSet
    ? await setCredits(db, userId, amount)
    : await addCredits(db, userId, amount);

  if (Number.isNaN(bal) || bal < 0) {
    // spend_credits(add<0) 는 잔액부족 시 -1을 주지만, 지급(음수 금액)은 항상 성공해야 함.
    // 여기 도달하면 컬럼/RPC 미설정이거나 대상 없음.
    const cur = await getCredits(db, userId);
    return NextResponse.json(
      {
        ok: false,
        reason: "크레딧 시스템이 아직 설정되지 않았어요. supabase/credits-schema.sql 을 실행해주세요.",
        credits: Number.isNaN(cur) ? null : cur,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, userId, credits: bal });
}
