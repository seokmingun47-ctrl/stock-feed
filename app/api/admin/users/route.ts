import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 관리자 전용: 가입자 목록 (최근 가입순)
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
  // email/created_at 컬럼이 없을 수도 있어 폴백
  const full = await db
    .from("community_users")
    .select("id, username, email, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (full.error) {
    const basic = await db
      .from("community_users")
      .select("id, username")
      .limit(1000);
    rows = (basic.data ?? []) as Record<string, unknown>[];
  } else {
    rows = (full.data ?? []) as Record<string, unknown>[];
  }

  const users = rows.map((r) => ({
    id: String(r.id),
    username: String(r.username ?? ""),
    email: (r.email as string) ?? null,
    createdAt: r.created_at ? Date.parse(String(r.created_at)) : 0,
  }));

  return NextResponse.json({ ok: true, users, total: users.length });
}
