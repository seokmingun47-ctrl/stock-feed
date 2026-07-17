import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getAdminClient } from "./supabase";
import { getUser } from "./auth";

export const AI_COST = 25;
export const SIGNUP_CREDITS = 2000;

// 원자 차감: 성공 시 잔액, 부족 시 -1, RPC/컬럼 미설정 시 NaN
export async function spendCredits(
  db: SupabaseClient,
  userId: string,
  amount = AI_COST,
): Promise<number> {
  try {
    const { data, error } = await db.rpc("spend_credits", {
      p_user: userId,
      p_amount: amount,
    });
    if (error) return NaN;
    return typeof data === "number" ? data : -1;
  } catch {
    return NaN;
  }
}

// 현재 잔액 (미설정 시 NaN)
export async function getCredits(
  db: SupabaseClient,
  userId: string,
): Promise<number> {
  try {
    const { data, error } = await db
      .from("community_users")
      .select("credits")
      .eq("id", userId)
      .single();
    if (error) return NaN;
    return Number((data as { credits?: number } | null)?.credits ?? 0);
  } catch {
    return NaN;
  }
}

export interface Charge {
  ok: boolean; // 진행 가능?
  status?: number; // !ok일 때 HTTP 상태
  reason?: string;
  code?: string;
  credits?: number; // 잔액 (성공=차감후, 부족=현재)
  unlimited?: boolean; // 관리자/미설정 → 차감 없음
  refund?: () => Promise<void>; // AI 실패 시 환불
}

// AI 라우트 공용: 로그인 확인 + 차감. 관리자/크레딧 미설정이면 무제한 허용.
export async function chargeAI(req: NextRequest): Promise<Charge> {
  const user = await getUser(req);
  if (!user) {
    return { ok: false, status: 401, reason: "로그인이 필요해요." };
  }
  // 관리자는 크레딧 무제한 (차감 없음)
  if (user.isAdmin) {
    return { ok: true, unlimited: true };
  }
  const db = getAdminClient();
  const bal = await spendCredits(db, user.id, AI_COST);
  if (Number.isNaN(bal)) {
    // 크레딧 시스템 미설정 → 제한 없이 통과
    return { ok: true };
  }
  if (bal === -1) {
    const cur = await getCredits(db, user.id);
    return {
      ok: false,
      status: 402,
      code: "NO_CREDITS",
      credits: Number.isNaN(cur) ? 0 : cur,
      reason: "AI 크레딧이 부족해요. 충전 후 다시 이용해 주세요.",
    };
  }
  return {
    ok: true,
    credits: bal,
    refund: async () => {
      await spendCredits(db, user.id, -AI_COST);
    },
  };
}
