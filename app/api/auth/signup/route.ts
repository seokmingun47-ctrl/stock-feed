import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import {
  hashPassword,
  signSession,
  validUsername,
  validEmail,
  isAdminUsername,
  SESSION_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  let body: { username?: unknown; email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");
  if (!validEmail(email)) {
    return NextResponse.json(
      { ok: false, reason: "올바른 이메일을 입력해주세요 (예: name@gmail.com)." },
      { status: 400 },
    );
  }
  if (!validUsername(username)) {
    return NextResponse.json(
      { ok: false, reason: "아이디는 영문/숫자/_/- 3~20자예요." },
      { status: 400 },
    );
  }
  if (password.length < 4) {
    return NextResponse.json(
      { ok: false, reason: "비밀번호는 4자 이상이어야 해요." },
      { status: 400 },
    );
  }

  const db = getAdminClient();
  // 아이디 중복 (대소문자 무시)
  const { data: existing } = await db
    .from("community_users")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { ok: false, reason: "이미 사용 중인 아이디예요." },
      { status: 409 },
    );
  }
  // 이메일 중복
  const { data: emailTaken } = await db
    .from("community_users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (emailTaken) {
    return NextResponse.json(
      { ok: false, reason: "이미 가입된 이메일이에요." },
      { status: 409 },
    );
  }

  const { data, error } = await db
    .from("community_users")
    .insert({ username, email, password_hash: hashPassword(password) })
    .select("id, username")
    .single();
  if (error || !data) {
    const reason = /email|column/i.test(error?.message ?? "")
      ? "이메일 가입 DB 설정이 아직 안 됐어요. supabase/email-schema.sql 을 실행해주세요."
      : error?.message || "가입에 실패했어요.";
    return NextResponse.json({ ok: false, reason }, { status: 500 });
  }

  const { token, maxAge } = signSession(String(data.id));
  const res = NextResponse.json({
    ok: true,
    user: {
      id: data.id,
      username: data.username,
      isAdmin: isAdminUsername(String(data.username)),
      isPro: isAdminUsername(String(data.username)), // 신규 가입은 기본 비프로
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
