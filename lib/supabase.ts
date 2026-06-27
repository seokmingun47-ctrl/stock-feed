import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Supabase 환경변수가 채워졌는지 확인 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  return url.startsWith("https://") && key.length > 0;
}

let adminClient: SupabaseClient | null = null;

/** 서버 전용 관리자 클라이언트 (secret key). RLS 우회 — 클라이언트로 노출 금지. */
export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return adminClient;
}
