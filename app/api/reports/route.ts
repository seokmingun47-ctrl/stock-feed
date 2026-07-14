import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { isReportTargetType } from "@/lib/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 콘텐츠/사용자 신고 (로그인 필요)
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const targetType = String(body.targetType ?? "");
  const targetId = String(body.targetId ?? "").slice(0, 200);
  const reason = String(body.reason ?? "").trim().slice(0, 60);
  const note = String(body.note ?? "").trim().slice(0, 500);
  if (!isReportTargetType(targetType) || !targetId || !reason) {
    return NextResponse.json({ ok: false, reason: "신고 정보가 올바르지 않아요." }, { status: 400 });
  }

  const db = getAdminClient();
  const { error } = await db.from("reports").insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    note: note || null,
  });
  if (error) {
    const reason = /reports|relation|table/i.test(error.message)
      ? "신고 기능 DB 설정이 아직 안 됐어요. supabase/moderation-schema.sql 을 실행해주세요."
      : error.message;
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
