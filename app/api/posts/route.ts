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
  const sort = req.nextUrl.searchParams.get("sort"); // 'popular' | 'latest'
  const db = getAdminClient();
  const user = await getUser(req);

  let q = db
    .from("community_posts")
    .select("*, community_comments(count)")
    .limit(100);
  q =
    sort === "popular"
      ? q.gte("like_count", 10).order("like_count", { ascending: false })
      : q.order("created_at", { ascending: false });

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message, posts: [] });
  }
  const posts = (data ?? []).map((r) => rowToPost(r as Record<string, unknown>));

  // 내가 좋아요한 글 표시
  if (user && posts.length) {
    const ids = posts.map((p) => p.id);
    const { data: myLikes } = await db
      .from("likes")
      .select("target_id")
      .eq("user_id", user.id)
      .eq("target_type", "post")
      .in("target_id", ids);
    const set = new Set((myLikes ?? []).map((l) => String(l.target_id)));
    for (const p of posts) p.liked = set.has(p.id);
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
  const { data, error } = await db
    .from("community_posts")
    .insert({ ...clean, nickname: user.username, user_id: user.id })
    .select("*, community_comments(count)")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, post: rowToPost(data as Record<string, unknown>) });
}
