import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { cleanPostInput, rowToPost } from "@/lib/community";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 게시글 목록
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db", posts: [] });
  }
  const params = req.nextUrl.searchParams;
  const sort = params.get("sort"); // 'popular' | 'latest'
  const kind = params.get("kind"); // 'news' | 'post' | null(전체)
  const author = params.get("author"); // 작성자 user_id (유저 채널)
  const db = getAdminClient();
  const user = await getUser(req);

  let q = db
    .from("community_posts")
    .select("*, community_comments(count)")
    .limit(100);
  if (kind === "news" || kind === "post") q = q.eq("kind", kind);
  if (author) q = q.eq("user_id", author);
  q =
    sort === "popular"
      ? q.gte("like_count", 10).order("like_count", { ascending: false })
      : q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message, posts: [] });
  }
  const posts = (data ?? []).map((r) => rowToPost(r as Record<string, unknown>));

  // 내가 좋아요한 글 / 팔로우한 작성자 표시
  if (user && posts.length) {
    const ids = posts.map((p) => p.id);
    const { data: myLikes } = await db
      .from("likes")
      .select("target_id")
      .eq("user_id", user.id)
      .eq("target_type", "post")
      .in("target_id", ids);
    const likeSet = new Set((myLikes ?? []).map((l) => String(l.target_id)));
    for (const p of posts) p.liked = likeSet.has(p.id);

    const authorIds = [
      ...new Set(posts.map((p) => p.userId).filter(Boolean) as string[]),
    ];
    if (authorIds.length) {
      try {
        const { data: myFollows } = await db
          .from("follows")
          .select("author_id")
          .eq("follower_id", user.id)
          .in("author_id", authorIds);
        const fSet = new Set(
          (myFollows ?? []).map((f) => String(f.author_id)),
        );
        for (const p of posts)
          p.following = !!p.userId && fSet.has(p.userId);
      } catch {
        /* follows 테이블 미설정 — following=false 유지 */
      }
    }
  }

  return NextResponse.json({ ok: true, posts });
}

// 게시글 작성 (로그인 필요, 작성자는 세션)
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "로그인이 필요해요." },
      { status: 401 },
    );
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const clean = cleanPostInput(body as Record<string, unknown>);
  if (!clean) {
    return NextResponse.json(
      { ok: false, reason: "제목을 입력해주세요." },
      { status: 400 },
    );
  }
  const db = getAdminClient();
  let { data, error } = await db
    .from("community_posts")
    .insert({ ...clean, nickname: user.username, user_id: user.id })
    .select("*, community_comments(count)")
    .single();
  // kind 컬럼 미설정(마이그레이션 전)이면 kind 없이 재시도 → 자유글로 저장
  if (error && /kind/i.test(error.message)) {
    const { kind: _kind, ...rest } = clean;
    void _kind;
    ({ data, error } = await db
      .from("community_posts")
      .insert({ ...rest, nickname: user.username, user_id: user.id })
      .select("*, community_comments(count)")
      .single());
  }
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, post: rowToPost(data as Record<string, unknown>) });
}
