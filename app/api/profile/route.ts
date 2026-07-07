import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 내 프로필 수정 (사진/색상/소개)
export async function PUT(req: NextRequest) {
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

  const patch: Record<string, unknown> = {};
  if ("avatarUrl" in body) {
    const a = body.avatarUrl;
    patch.avatar_url = a == null || a === "" ? null : String(a).slice(0, 500);
  }
  if ("profileColor" in body) {
    const c = String(body.profileColor ?? "").trim();
    patch.profile_color = /^#[0-9a-fA-F]{6}$/.test(c) ? c : null;
  }
  if ("bio" in body) {
    const b = String(body.bio ?? "").trim().slice(0, 160);
    patch.bio = b || null;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ ok: false, reason: "변경할 내용이 없어요." }, { status: 400 });
  }

  const db = getAdminClient();
  const { error } = await db
    .from("community_users")
    .update(patch)
    .eq("id", user.id);
  if (error) {
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin,
      avatarUrl: "avatar_url" in patch ? patch.avatar_url : user.avatarUrl,
      profileColor:
        "profile_color" in patch ? patch.profile_color : user.profileColor,
      bio: "bio" in patch ? patch.bio : user.bio,
    },
  });
}
