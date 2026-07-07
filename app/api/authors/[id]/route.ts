import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { rowToPost, attachAuthorProfiles } from "@/lib/community";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 유저 프로필/채널 — 작성자 정보 + 그 유저의 뉴스 + 팔로우 상태
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

  const auRes = await db
    .from("community_users")
    .select("id, username, avatar_url, profile_color, bio")
    .eq("id", id)
    .single();
  let au = auRes.data as Record<string, unknown> | null;
  if (!au) {
    const auRes2 = await db
      .from("community_users")
      .select("id, username")
      .eq("id", id)
      .single();
    au = auRes2.data as Record<string, unknown> | null;
  }
  if (!au) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  // 이 유저의 뉴스
  const { data: rows } = await db
    .from("community_posts")
    .select("*, community_comments(count)")
    .eq("kind", "news")
    .eq("user_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  const news = (rows ?? []).map((r) => rowToPost(r as Record<string, unknown>));
  await attachAuthorProfiles(db, news);

  // 내가 좋아요한 뉴스 표시
  if (user && news.length) {
    const ids = news.map((p) => p.id);
    const { data: myLikes } = await db
      .from("likes")
      .select("target_id")
      .eq("user_id", user.id)
      .eq("target_type", "post")
      .in("target_id", ids);
    const set = new Set((myLikes ?? []).map((l) => String(l.target_id)));
    for (const p of news) p.liked = set.has(p.id);
  }

  // 팔로워 수 + 내가 팔로우 중인지
  let followerCount = 0;
  let following = false;
  try {
    const { count } = await db
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("author_id", id);
    followerCount = count ?? 0;
    if (user) {
      const { data: f } = await db
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("author_id", id)
        .maybeSingle();
      following = !!f;
    }
  } catch {
    /* follows 미설정 */
  }

  return NextResponse.json({
    ok: true,
    author: {
      id: String(au.id),
      username: String(au.username),
      newsCount: news.length,
      followerCount,
      avatarUrl: (au.avatar_url as string) ?? null,
      profileColor: (au.profile_color as string) ?? null,
      bio: (au.bio as string) ?? null,
    },
    following,
    news,
  });
}
