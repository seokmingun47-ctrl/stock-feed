import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { rowToRoom } from "@/lib/community";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 그룹방 목록 (최근 활동순) + 참여 인원
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db", rooms: [] });
  }
  const db = getAdminClient();
  const { data, error } = await db
    .from("group_rooms")
    .select("*")
    .order("last_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message, rooms: [] });
  }
  const rows = data ?? [];
  // 참여 인원 배치 집계
  const ids = rows.map((r) => String(r.id));
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: mem } = await db
      .from("group_members")
      .select("room_id")
      .in("room_id", ids);
    for (const m of mem ?? []) {
      const k = String(m.room_id);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  const rooms = rows.map((r) =>
    rowToRoom(r as Record<string, unknown>, counts.get(String(r.id)) ?? 0),
  );
  return NextResponse.json({ ok: true, rooms });
}

// 그룹방 생성 (로그인 필요)
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
  const name = String(body.name ?? "").trim().slice(0, 40);
  const description = String(body.description ?? "").trim().slice(0, 200);
  const emojiRaw = String(body.emoji ?? "").trim();
  const emoji = emojiRaw ? [...emojiRaw][0] : null; // 이모지 1글자
  if (!name) {
    return NextResponse.json(
      { ok: false, reason: "방 이름을 입력해주세요." },
      { status: 400 },
    );
  }
  const db = getAdminClient();
  const { data, error } = await db
    .from("group_rooms")
    .insert({
      name,
      description,
      emoji,
      owner_id: user.id,
      nickname: user.username,
    })
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  // 개설자는 자동 참여
  await db
    .from("group_members")
    .insert({ room_id: data.id, user_id: user.id });
  return NextResponse.json({
    ok: true,
    room: rowToRoom(data as Record<string, unknown>, 1),
  });
}
