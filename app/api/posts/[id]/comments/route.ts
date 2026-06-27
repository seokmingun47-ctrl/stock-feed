import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { rowToComment } from "@/lib/community";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 댓글 작성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const nickname = String(b.nickname ?? "").trim().slice(0, 20);
  const text = String(b.body ?? "").trim().slice(0, 2000);
  if (!nickname || !text) {
    return NextResponse.json(
      { ok: false, reason: "닉네임과 내용은 필수예요." },
      { status: 400 },
    );
  }
  const db = getAdminClient();
  const { data, error } = await db
    .from("community_comments")
    .insert({ post_id: id, nickname, body: text })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    comment: rowToComment(data as Record<string, unknown>),
  });
}
