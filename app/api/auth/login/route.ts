import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  verifyPassword,
  signSession,
  isAdminUsername,
  SESSION_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  let body: { username?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const id = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  const db = getAdminClient();
  // 이메일(@ 포함)이면 이메일로, 아니면 아이디로 조회
  const col = id.includes("@") ? "email" : "username";
  let user: Record<string, unknown> | null = null;
  // 프로필(사진/색상/소개)까지 함께 조회 → 로그인 직후에도 프로필 유지
  const full = await db
    .from("community_users")
    .select("id, username, password_hash, avatar_url, profile_color, bio, is_pro")
    .ilike(col, id)
    .maybeSingle();
  if (full.error) {
    // is_pro 컬럼 미설정(마이그레이션 전) → 프로필 컬럼까지는 유지
    const mid = await db
      .from("community_users")
      .select("id, username, password_hash, avatar_url, profile_color, bio")
      .ilike(col, id)
      .maybeSingle();
    if (mid.error) {
      const basic = await db
        .from("community_users")
        .select("id, username, password_hash")
        .ilike("username", id)
        .maybeSingle();
      user = basic.data as Record<string, unknown> | null;
    } else {
      user = mid.data as Record<string, unknown> | null;
    }
  } else {
    user = full.data as Record<string, unknown> | null;
  }

  if (!user || !verifyPassword(password, String(user.password_hash))) {
    return NextResponse.json(
      { ok: false, reason: "아이디 또는 비밀번호가 틀렸어요." },
      { status: 401 },
    );
  }

  const { token, maxAge } = signSession(String(user.id));
  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      isAdmin: isAdminUsername(String(user.username)),
      isPro: Boolean(user.is_pro) || isAdminUsername(String(user.username)),
      avatarUrl: (user.avatar_url as string) ?? null,
      profileColor: (user.profile_color as string) ?? null,
      bio: (user.bio as string) ?? null,
    },
  });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  return res;
}
