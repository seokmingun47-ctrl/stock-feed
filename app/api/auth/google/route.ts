import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const OAUTH_STATE_COOKIE = "ns_oauth_state";

/** 구글 OAuth가 돌아올 주소. 구글 콘솔의 '승인된 리디렉션 URI'와 정확히 같아야 한다. */
export function googleRedirectUri(req: NextRequest): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  return `${base}/api/auth/google/callback`;
}

// 구글 로그인 시작 — 동의 화면으로 보낸다
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    // 키 미설정이면 조용히 실패하지 말고 이유를 알린다
    return NextResponse.redirect(new URL("/?login=1&err=google_off", req.nextUrl.origin));
  }

  // CSRF 방지: 무작위 state를 쿠키에 심고, 콜백에서 대조한다
  const state = randomBytes(16).toString("hex");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // 이미 로그인된 구글 계정이 여러 개면 고를 수 있게
  url.searchParams.set("prompt", "select_account");

  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10분
  });
  return res;
}
