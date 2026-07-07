import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { rowToPost, rowToComment, attachAuthorProfiles } from "@/lib/community";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 게시글 상세 + 댓글 (+ 조회수 증가)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const { id } = await params;
  const db = getAdminClient();
  const user = await getUser(req);

  await db.rpc("increment_post_views", { p_id: id });

  const { data: postRow, error } = await db
    .from("community_posts")
    .select("*, community_comments(count)")
    .eq("id", id)
    .single();
  if (error || !postRow) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  const post = rowToPost(postRow as Record<string, unknown>);
  await attachAuthorProfiles(db, [post]);
  if (user) {
    const { data: like } = await db
      .from("likes")
      .select("id")
      .eq("user_id", user.id)
      .eq("target_type", "post")
      .eq("target_id", id)
      .maybeSingle();
    post.liked = !!like;
  }

  // 작성자 팔로우 상태 + 팔로워 수 (follows 미설정이면 0/false)
  let followerCount = 0;
  if (post.userId) {
    try {
      const { count } = await db
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("author_id", post.userId);
      followerCount = count ?? 0;
      if (user) {
        const { data: f } = await db
          .from("follows")
          .select("id")
          .eq("follower_id", user.id)
          .eq("author_id", post.userId)
          .maybeSingle();
        post.following = !!f;
      }
    } catch {
      /* follows 테이블 미설정 */
    }
  }

  const { data: commentRows } = await db
    .from("community_comments")
    .select("*")
    .eq("post_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ok: true,
    post,
    followerCount,
    comments: (commentRows ?? []).map((r) =>
      rowToComment(r as Record<string, unknown>),
    ),
  });
}

// 게시글 삭제 — 관리자 또는 작성자만
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
  const { data: post } = await db
    .from("community_posts")
    .select("user_id")
    .eq("id", id)
    .single();
  if (!post) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  const isOwner = post.user_id && String(post.user_id) === user.id;
  if (!user.isAdmin && !isOwner) {
    return NextResponse.json({ ok: false, reason: "권한이 없어요." }, { status: 403 });
  }
  const { error } = await db.from("community_posts").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

