import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { SESSION_COOKIE, signSession } from "@/lib/auth";
import { SIGNUP_CREDITS } from "@/lib/credits";
import { OAUTH_STATE_COOKIE, googleRedirectUri } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface GoogleUser {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

/** 표시용 아이디 만들기 — 이메일 앞부분 기반, 중복이면 숫자를 붙인다 */
async function uniqueUsername(
  db: ReturnType<typeof getAdminClient>,
  seed: string,
): Promise<string> {
  const base =
    seed
      .replace(/[^A-Za-z0-9가-힣_]/g, "")
      .slice(0, 16)
      .toLowerCase() || "user";
  for (let i = 0; i < 20; i++) {
    const name = i === 0 ? base : `${base}${i}`;
    const { data } = await db
      .from("community_users")
      .select("id")
      .eq("username", name)
      .maybeSingle();
    if (!data) return name;
  }
  return `${base}${Date.now().toString().slice(-5)}`;
}

function fail(origin: string, code: string) {
  return NextResponse.redirect(new URL(`/?login=1&err=${code}`, origin));
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail(origin, "google_off");
  if (!isSupabaseConfigured()) return fail(origin, "no_db");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const saved = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // 사용자가 동의 화면에서 취소한 경우
  if (req.nextUrl.searchParams.get("error")) return fail(origin, "canceled");
  // CSRF: 쿠키의 state와 일치해야 한다
  if (!code || !state || !saved || state !== saved) return fail(origin, "state");

  // 1) 코드 → 토큰
  let idTokenPayload: GoogleUser | null = null;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail(origin, "token");
    const tok = (await tokenRes.json()) as { access_token?: string };
    if (!tok.access_token) return fail(origin, "token");

    // 2) 토큰 → 사용자 정보
    const meRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!meRes.ok) return fail(origin, "userinfo");
    idTokenPayload = (await meRes.json()) as GoogleUser;
  } catch {
    return fail(origin, "network");
  }

  const email = (idTokenPayload.email || "").trim().toLowerCase();
  // ⚠️ 미인증 이메일로는 기존 계정에 붙이면 안 된다(계정 탈취 경로가 된다)
  if (!email || idTokenPayload.email_verified === false) {
    return fail(origin, "email");
  }

  const db = getAdminClient();

  // 3) 기존 회원이면 로그인, 없으면 생성
  let userId: string | null = null;
  const { data: found } = await db
    .from("community_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (found) {
    userId = String(found.id);
  } else {
    const username = await uniqueUsername(db, idTokenPayload.name || email.split("@")[0]);
    // 비밀번호 로그인은 못 쓰게 — 어떤 입력과도 일치하지 않는 무작위 값
    const unusable = `google:${randomBytes(32).toString("hex")}`;
    const base = { username, email, password_hash: unusable };
    const insertUser = (payload: Record<string, unknown>) =>
      db.from("community_users").insert(payload).select("id").single();
    // 무료 플랜 초기 크레딧 지급 (credits 컬럼 없으면 크레딧 없이 재시도)
    let ins = await insertUser({ ...base, credits: SIGNUP_CREDITS });
    if (ins.error && /credits|column/i.test(ins.error.message ?? "")) {
      ins = await insertUser(base);
    }
    if (ins.error || !ins.data) return fail(origin, "create");
    userId = String(ins.data.id);
  }

  // 4) 세션 발급
  const { token, maxAge } = signSession(userId);
  const res = NextResponse.redirect(new URL("/", origin));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}
