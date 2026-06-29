import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { rowToComment } from "@/lib/community";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 댓글 작성 (로그인 필요, 작성자는 세션)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const text = String((body as Record<string, unknown>).body ?? "")
    .trim()
    .slice(0, 2000);
  if (!text) {
    return NextResponse.json(
      { ok: false, reason: "내용을 입력해주세요." },
      { status: 400 },
    );
  }
  const db = getAdminClient();
  const { data, error } = await db
    .from("community_comments")
    .insert({
      post_id: id,
      nickname: user.username,
      user_id: user.id,
      body: text,
    })
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
