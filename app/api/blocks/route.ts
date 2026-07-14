import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { getBlockedIds } from "@/lib/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 내가 차단한 사용자 목록
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, blocked: [] });
  }
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: true, blocked: [] });
  const db = getAdminClient();
  const set = await getBlockedIds(db, user.id);
  return NextResponse.json({ ok: true, blocked: [...set] });
}

// 차단/차단해제 토글
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  }
  let body: { targetId?: unknown; block?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const targetId = String(body.targetId ?? "");
  const block = body.block !== false; // 기본 차단
  if (!targetId || targetId === user.id) {
    return NextResponse.json({ ok: false, reason: "잘못된 요청이에요." }, { status: 400 });
  }
  const db = getAdminClient();
  let error;
  if (block) {
    ({ error } = await db
      .from("blocks")
      .upsert(
        { blocker_id: user.id, blocked_id: targetId },
        { onConflict: "blocker_id,blocked_id" },
      ));
  } else {
    ({ error } = await db
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetId));
  }
  if (error) {
    const reason = /blocks|relation|table/i.test(error.message)
      ? "차단 기능 DB 설정이 아직 안 됐어요. supabase/moderation-schema.sql 을 실행해주세요."
      : error.message;
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }
  return NextResponse.json({ ok: true, blocked: block });
}
