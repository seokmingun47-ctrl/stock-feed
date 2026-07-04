import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import type { Author } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 내가 팔로우한 작성자 목록 (뉴스탭 채널 칩용)
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, authors: [] });
  }
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: true, authors: [] });
  const db = getAdminClient();

  try {
    const { data: rows } = await db
      .from("follows")
      .select("author_id")
      .eq("follower_id", user.id)
      .order("created_at", { ascending: true });
    const ids = [...new Set((rows ?? []).map((r) => String(r.author_id)))];
    if (!ids.length) return NextResponse.json({ ok: true, authors: [] });

    const { data: users } = await db
      .from("community_users")
      .select("id, username")
      .in("id", ids);
    const nameMap = new Map(
      (users ?? []).map((u) => [String(u.id), String(u.username)]),
    );

    // 각 작성자의 뉴스 개수
    const { data: newsRows } = await db
      .from("community_posts")
      .select("user_id")
      .eq("kind", "news")
      .in("user_id", ids);
    const counts = new Map<string, number>();
    for (const r of newsRows ?? []) {
      const k = String(r.user_id);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    // 팔로우한 순서 유지
    const authors: Author[] = ids
      .filter((id) => nameMap.has(id))
      .map((id) => ({
        id,
        username: nameMap.get(id)!,
        newsCount: counts.get(id) ?? 0,
      }));
    return NextResponse.json({ ok: true, authors });
  } catch {
    return NextResponse.json({ ok: true, authors: [] });
  }
}

// 팔로우 토글
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
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const authorId = String(body.authorId ?? "");
  if (!authorId) {
    return NextResponse.json({ ok: false, reason: "bad-target" }, { status: 400 });
  }
  if (authorId === user.id) {
    return NextResponse.json(
      { ok: false, reason: "자기 자신은 팔로우할 수 없어요." },
      { status: 400 },
    );
  }
  const db = getAdminClient();

  const { data: existing } = await db
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("author_id", authorId)
    .maybeSingle();

  let following: boolean;
  if (existing) {
    await db.from("follows").delete().eq("id", existing.id);
    following = false;
  } else {
    await db
      .from("follows")
      .insert({ follower_id: user.id, author_id: authorId });
    following = true;
  }

  const { count } = await db
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("author_id", authorId);

  return NextResponse.json({ ok: true, following, followerCount: count ?? 0 });
}
