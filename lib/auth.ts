import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHmac,
} from "crypto";
import type { NextRequest } from "next/server";
import { getAdminClient } from "./supabase";

export const SESSION_COOKIE = "ns_session";
const SESSION_DAYS = 30;

export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
  isPro: boolean;
  avatarUrl?: string | null;
  profileColor?: string | null;
  bio?: string | null;
}

// ── 비밀번호 (scrypt) ──
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const h = scryptSync(pw, salt, 64);
  const hb = Buffer.from(hash, "hex");
  return h.length === hb.length && timingSafeEqual(h, hb);
}

// ── 세션 토큰 (HMAC 서명, 무상태) ──
function secret(): string {
  return process.env.SESSION_SECRET || "dev-insecure-secret";
}

export function signSession(userId: string): { token: string; maxAge: number } {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  const exp = Date.now() + maxAge * 1000;
  const data = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(data).digest("hex");
  return { token: `${data}.${sig}`, maxAge };
}

export function verifySession(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!exp || Date.now() > exp) return null;
  const expected = createHmac("sha256", secret())
    .update(`${userId}.${expStr}`)
    .digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export function isAdminUsername(username: string): boolean {
  const admin = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  return !!admin && username.trim().toLowerCase() === admin;
}

// 요청의 세션 쿠키로 현재 사용자 조회
export async function getUser(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySession(token);
  if (!userId) return null;
  const db = getAdminClient();
  const res = await db
    .from("community_users")
    .select("id, username, avatar_url, profile_color, bio, is_pro")
    .eq("id", userId)
    .single();
  let data = res.data as Record<string, unknown> | null;
  // 프로필/is_pro 컬럼 미설정(마이그레이션 전)이면 기본 컬럼만
  if (!data) {
    const res2 = await db
      .from("community_users")
      .select("id, username")
      .eq("id", userId)
      .single();
    data = res2.data as Record<string, unknown> | null;
  }
  if (!data) return null;
  const isAdmin = isAdminUsername(String(data.username));
  return {
    id: String(data.id),
    username: String(data.username),
    isAdmin,
    isPro: Boolean(data.is_pro) || isAdmin, // 관리자는 항상 프로
    avatarUrl: (data.avatar_url as string) ?? null,
    profileColor: (data.profile_color as string) ?? null,
    bio: (data.bio as string) ?? null,
  };
}

// 아이디 규칙: 영문/숫자/_/- 3~20자
export function validUsername(u: string): boolean {
  return /^[A-Za-z0-9_-]{3,20}$/.test(u);
}

// 이메일 형식 (gmail 등)
export function validEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 120;
}
