import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { rowToPost, rowToComment } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 게시글 상세 + 댓글 (+ 조회수 증가)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const { id } = await params;
  const db = getAdminClient();

  await db.rpc("increment_post_views", { p_id: id });

  const { data: postRow, error } = await db
    .from("community_posts")
    .select("*, community_comments(count)")
    .eq("id", id)
    .single();
  if (error || !postRow) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  const { data: commentRows } = await db
    .from("community_comments")
    .select("*")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ok: true,
    post: rowToPost(postRow as Record<string, unknown>),
    comments: (commentRows ?? []).map((r) =>
      rowToComment(r as Record<string, unknown>),
    ),
  });
}
