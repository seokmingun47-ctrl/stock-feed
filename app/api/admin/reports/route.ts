import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 관리자 전용: 신고 목록 (최근순)
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db", reports: [] });
  }
  const me = await getUser(req);
  if (!me || !me.isAdmin) {
    return NextResponse.json({ ok: false, reason: "관리자만 볼 수 있어요.", reports: [] }, { status: 403 });
  }
  const db = getAdminClient();
  const { data, error } = await db
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message, reports: [] });
  }
  const rows = (data ?? []) as Record<string, unknown>[];

  // 신고자 닉네임 매핑
  const reporterIds = [
    ...new Set(rows.map((r) => r.reporter_id).filter(Boolean).map(String)),
  ];
  const nameMap = new Map<string, string>();
  if (reporterIds.length) {
    const { data: us } = await db
      .from("community_users")
      .select("id, username")
      .in("id", reporterIds);
    for (const u of us ?? []) nameMap.set(String(u.id), String(u.username));
  }

  const reports = rows.map((r) => ({
    id: String(r.id),
    targetType: String(r.target_type ?? ""),
    targetId: String(r.target_id ?? ""),
    reason: String(r.reason ?? ""),
    note: (r.note as string) ?? null,
    status: String(r.status ?? "pending"),
    reporter: r.reporter_id ? nameMap.get(String(r.reporter_id)) ?? "?" : "(탈퇴)",
    createdAt: r.created_at ? Date.parse(String(r.created_at)) : 0,
  }));
  return NextResponse.json({ ok: true, reports });
}
