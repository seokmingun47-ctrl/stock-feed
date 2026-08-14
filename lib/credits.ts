import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { getAdminClient } from "./supabase";
import { getUser } from "./auth";
import { PRO_PLAN } from "./plan";

export const AI_COST = 25;
// 무료 플랜: 가입 시 지급되는 초기 크레딧
export const SIGNUP_CREDITS = 1000;

// 관리자 지급 등: 특정 사용자 크레딧을 절대값으로 설정. 성공 시 잔액, 실패 시 NaN.
export async function setCredits(
  db: SupabaseClient,
  userId: string,
  value: number,
): Promise<number> {
  try {
    const v = Math.max(0, Math.round(value));
    const { data, error } = await db
      .from("community_users")
      .update({ credits: v })
      .eq("id", userId)
      .select("credits")
      .single();
    if (error) return NaN;
    return Number((data as { credits?: number } | null)?.credits ?? v);
  } catch {
    return NaN;
  }
}

// 관리자 지급: 현재 잔액에 delta 만큼 더한다(음수면 차감). spend_credits(-delta)로 원자 처리.
// 잔액이 delta보다 작아도(충전은 항상) 성공하도록 음수 금액으로 호출.
export async function addCredits(
  db: SupabaseClient,
  userId: string,
  delta: number,
): Promise<number> {
  return spendCredits(db, userId, -Math.round(delta));
}

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

/**
 * 프로 시작·갱신: 잔액을 프로 지급액으로 **맞춘다**(더하지 않음).
 *
 * 프로는 차감이 없어(chargeAI가 unlimited) 매달 더하면 쌓이기만 합니다.
 * 3개월이면 30,000이 되고, 해지할 때 그 숫자가 사라지는 것처럼 보입니다.
 * 설정 방식이면 구독 중에는 늘 10,000으로 보이고 해지 시 1,000이 됩니다.
 */
export async function grantProCredits(
  db: SupabaseClient,
  userId: string,
): Promise<void> {
  await setCredits(db, userId, PRO_PLAN.credits);
}

/**
 * 프로 종료(해지 만료·결제 실패): 무료 플랜 지급액으로 되돌린다.
 * 되돌리지 않으면 해지 후에도 10,000을 들고 무료로 계속 쓰게 됩니다.
 */
export async function resetToFreePlan(
  db: SupabaseClient,
  userId: string,
): Promise<void> {
  await setCredits(db, userId, SIGNUP_CREDITS);
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
  // 관리자·프로는 크레딧 무제한 (차감 없음).
  // 프로의 유일한 혜택 = 광고 없이·소진 없이 AI를 마음껏 쓰는 것.
  if (user.isAdmin || user.isPro) {
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
