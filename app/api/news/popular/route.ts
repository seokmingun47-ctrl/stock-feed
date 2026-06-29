import { NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import type { NewsItem } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 인기 뉴스 — 좋아요 10개 이상
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db", items: [] });
  }
  const db = getAdminClient();
  const { data, error } = await db
    .from("news_items")
    .select("*")
    .gte("like_count", 10)
    .order("like_count", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message, items: [] });
  }
  const items: NewsItem[] = (data ?? []).map((r) => ({
    url: String(r.url),
    title: String(r.title ?? ""),
    sourceId: String(r.source_id ?? ""),
    image: r.image ? String(r.image) : null,
    likeCount: Number(r.like_count ?? 0),
    commentCount: Number(r.comment_count ?? 0),
  }));
  return NextResponse.json({ ok: true, items });
}
