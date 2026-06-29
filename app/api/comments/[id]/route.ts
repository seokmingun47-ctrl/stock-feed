import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 댓글 삭제 — 관리자 또는 작성자만
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  }
  const { id } = await params;
  const db = getAdminClient();
  const { data: comment } = await db
    .from("community_comments")
    .select("user_id")
    .eq("id", id)
    .single();
  if (!comment) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  const isOwner = comment.user_id && String(comment.user_id) === user.id;
  if (!user.isAdmin && !isOwner) {
    return NextResponse.json({ ok: false, reason: "권한이 없어요." }, { status: 403 });
  }
  const { error } = await db.from("community_comments").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
