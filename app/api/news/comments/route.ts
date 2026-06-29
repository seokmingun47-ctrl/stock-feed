import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { rowToComment } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 뉴스 댓글 작성
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
  const url = String(body.url ?? "");
  const text = String(body.body ?? "").trim().slice(0, 2000);
  if (!url || !text) {
    return NextResponse.json(
      { ok: false, reason: "내용을 입력해주세요." },
      { status: 400 },
    );
  }
  const db = getAdminClient();

  // news_items 행 확보(메타 저장) → 댓글 수 카운트 가능
  const meta = (body.meta ?? {}) as Record<string, unknown>;
  await db.from("news_items").upsert(
    {
      url,
      title: String(meta.title ?? "").slice(0, 300),
      source_id: String(meta.sourceId ?? ""),
      image: meta.image ? String(meta.image) : null,
    },
    { onConflict: "url", ignoreDuplicates: true },
  );

  const { data, error } = await db
    .from("news_comments")
    .insert({
      article_url: url,
      user_id: user.id,
      nickname: user.username,
      body: text,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  await db.rpc("bump_news_comments", { p_url: url, d: 1 });

  return NextResponse.json({
    ok: true,
    comment: rowToComment(data as Record<string, unknown>),
  });
}
