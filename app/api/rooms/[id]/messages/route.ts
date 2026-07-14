import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { rowToGroupMessage } from "@/lib/community";
import { getUser } from "@/lib/auth";
import { getBlockedIds } from "@/lib/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 메시지 조회 (after=epoch ms 이후만 — 폴링용). 없으면 최근 60개.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db", messages: [] });
  }
  const { id } = await params;
  const after = req.nextUrl.searchParams.get("after");
  const db = getAdminClient();

  let q = db
    .from("group_messages")
    .select("*, community_users(avatar_url, profile_color)")
    .eq("room_id", id);
  if (after) {
    const ms = Number(after);
    if (Number.isFinite(ms) && ms > 0) {
      q = q.gt("created_at", new Date(ms).toISOString());
      q = q.order("created_at", { ascending: true }).limit(200);
    } else {
      q = q.order("created_at", { ascending: false }).limit(60);
    }
  } else {
    q = q.order("created_at", { ascending: false }).limit(60);
  }

  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message, messages: [] });
  }
  let rows = data ?? [];
  // after 없이 조회하면 desc라 → 시간순으로 뒤집기
  if (!after) rows = rows.slice().reverse();
  let messages = rows.map((r) =>
    rowToGroupMessage(r as Record<string, unknown>),
  );
  // 차단한 사용자 메시지 숨김
  const me = await getUser(req);
  if (me) {
    const blocked = await getBlockedIds(db, me.id);
    if (blocked.size)
      messages = messages.filter((m) => !m.userId || !blocked.has(m.userId));
  }
  return NextResponse.json({ ok: true, messages });
}

// 메시지 전송 (로그인 필요). 멤버 등록 + 방 미리보기 갱신.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  }
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const text = String(body.body ?? "").trim().slice(0, 1000);
  if (!text) {
    return NextResponse.json({ ok: false, reason: "empty" }, { status: 400 });
  }
  const db = getAdminClient();
  const { data, error } = await db
    .from("group_messages")
    .insert({ room_id: id, user_id: user.id, nickname: user.username, body: text })
    .select("*, community_users(avatar_url, profile_color)")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  // 멤버 등록 + 방 미리보기(최근 메시지) 갱신 (베스트에포트)
  await Promise.all([
    db
      .from("group_members")
      .upsert(
        { room_id: id, user_id: user.id },
        { onConflict: "room_id,user_id", ignoreDuplicates: true },
      ),
    db
      .from("group_rooms")
      .update({ last_body: text.slice(0, 100), last_at: new Date().toISOString() })
      .eq("id", id),
  ]);
  return NextResponse.json({
    ok: true,
    message: rowToGroupMessage(data as Record<string, unknown>),
  });
}
