import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { rowToRoom } from "@/lib/community";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 그룹방 상세 (+ 입장 시 멤버 등록)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const { id } = await params;
  const db = getAdminClient();
  const user = await getUser(req);

  const { data: room, error } = await db
    .from("group_rooms")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !room) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  // 입장 = 멤버 등록 (있으면 무시)
  if (user) {
    await db
      .from("group_members")
      .upsert(
        { room_id: id, user_id: user.id },
        { onConflict: "room_id,user_id", ignoreDuplicates: true },
      );
  }
  const { count } = await db
    .from("group_members")
    .select("*", { count: "exact", head: true })
    .eq("room_id", id);

  return NextResponse.json({
    ok: true,
    room: rowToRoom(room as Record<string, unknown>, count ?? 0),
  });
}

// 그룹방 삭제 — 개설자 또는 관리자
export async function DELETE(
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
  const db = getAdminClient();
  const { data: room } = await db
    .from("group_rooms")
    .select("owner_id")
    .eq("id", id)
    .single();
  if (!room) {
    return NextResponse.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  const isOwner = room.owner_id && String(room.owner_id) === user.id;
  if (!user.isAdmin && !isOwner) {
    return NextResponse.json({ ok: false, reason: "권한이 없어요." }, { status: 403 });
  }
  const { error } = await db.from("group_rooms").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
