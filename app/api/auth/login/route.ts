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
  try {
    const { data } = await db
      .from("community_users")
      .select("id, username, password_hash")
      .ilike(col, id)
      .maybeSingle();
    user = data as Record<string, unknown> | null;
  } catch {
    user = null;
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
