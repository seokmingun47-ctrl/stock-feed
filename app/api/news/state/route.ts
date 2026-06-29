import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { rowToComment } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 뉴스 기사의 좋아요 수 / 내가 눌렀는지 / 댓글
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ ok: false, reason: "no-url" }, { status: 400 });
  }
  const db = getAdminClient();
  const user = await getUser(req);

  const { data: item } = await db
    .from("news_items")
    .select("like_count")
    .eq("url", url)
    .maybeSingle();

  let liked = false;
  if (user) {
    const { data: like } = await db
      .from("likes")
      .select("id")
      .eq("user_id", user.id)
      .eq("target_type", "news")
      .eq("target_id", url)
      .maybeSingle();
    liked = !!like;
  }

  const { data: commentRows } = await db
    .from("news_comments")
    .select("*")
    .eq("article_url", url)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ok: true,
    likeCount: Number(item?.like_count ?? 0),
    liked,
    comments: (commentRows ?? []).map((r) =>
      rowToComment(r as Record<string, unknown>),
    ),
  });
}
