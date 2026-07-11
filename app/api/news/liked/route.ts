import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 내가 하트(좋아요) 누른 뉴스 목록 — 기록/저장한 뉴스
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, items: [] });
  }
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: true, items: [] });
  const db = getAdminClient();

  // 최근에 하트한 순서
  const { data: myLikes } = await db
    .from("likes")
    .select("target_id, created_at")
    .eq("user_id", user.id)
    .eq("target_type", "news")
    .order("created_at", { ascending: false })
    .limit(100);
  const urls = [...new Set((myLikes ?? []).map((l) => String(l.target_id)))];
  if (!urls.length) return NextResponse.json({ ok: true, items: [] });

  const { data: rows } = await db.from("news_items").select("*").in("url", urls);
  const map = new Map(
    (rows ?? []).map((r) => [String(r.url), r as Record<string, unknown>]),
  );
  const items = urls
    .map((u) => map.get(u))
    .filter(Boolean)
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        url: String(o.url),
        title: String(o.title ?? ""),
        sourceId: String(o.source_id ?? ""),
        image: (o.image as string) ?? null,
        likeCount: Number(o.like_count ?? 0),
        commentCount: Number(o.comment_count ?? 0),
      };
    });

  return NextResponse.json({ ok: true, items });
}
