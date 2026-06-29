import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 좋아요 토글 (글/뉴스)
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const targetType = String(body.targetType ?? "");
  const targetId = String(body.targetId ?? "");
  if (!["post", "news"].includes(targetType) || !targetId) {
    return NextResponse.json({ ok: false, reason: "bad-target" }, { status: 400 });
  }
  const db = getAdminClient();

  const { data: existing } = await db
    .from("likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  let liked: boolean;
  if (existing) {
    await db.from("likes").delete().eq("id", existing.id);
    if (targetType === "post")
      await db.rpc("bump_post_likes", { p_id: targetId, d: -1 });
    else await db.rpc("bump_news_likes", { p_url: targetId, d: -1 });
    liked = false;
  } else {
    // 뉴스는 좋아요 전에 news_items 행을 확보(메타 저장)
    if (targetType === "news") {
      const meta = (body.meta ?? {}) as Record<string, unknown>;
      await db.from("news_items").upsert(
        {
          url: targetId,
          title: String(meta.title ?? "").slice(0, 300),
          source_id: String(meta.sourceId ?? ""),
          image: meta.image ? String(meta.image) : null,
        },
        { onConflict: "url", ignoreDuplicates: true },
      );
    }
    await db
      .from("likes")
      .insert({ user_id: user.id, target_type: targetType, target_id: targetId });
    if (targetType === "post")
      await db.rpc("bump_post_likes", { p_id: targetId, d: 1 });
    else await db.rpc("bump_news_likes", { p_url: targetId, d: 1 });
    liked = true;
  }

  // 최신 카운트
  let count = 0;
  if (targetType === "post") {
    const { data } = await db
      .from("community_posts")
      .select("like_count")
      .eq("id", targetId)
      .single();
    count = Number(data?.like_count ?? 0);
  } else {
    const { data } = await db
      .from("news_items")
      .select("like_count")
      .eq("url", targetId)
      .single();
    count = Number(data?.like_count ?? 0);
  }

  return NextResponse.json({ ok: true, liked, count });
}
