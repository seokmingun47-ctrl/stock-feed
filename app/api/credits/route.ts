import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { getCredits } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 내 AI 크레딧 잔액 (미설정이면 credits: null → UI에서 숨김)
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, credits: null });
  }
  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: true, credits: null, isPro: false, unlimited: false });
  }
  // 관리자·프로는 무제한(chargeAI에서 차감하지 않음) → 잔액 조회 없이 표시만.
  // 여기서 unlimited를 안 내려주면 UI가 잔액 숫자와 "1회에 25" 안내를 띄워
  // 실제 동작(무제한)과 어긋난다.
  if (user.isAdmin || user.isPro) {
    return NextResponse.json({ ok: true, credits: null, isPro: true, unlimited: true });
  }
  const db = getAdminClient();
  const c = await getCredits(db, user.id);
  return NextResponse.json({
    ok: true,
    credits: Number.isNaN(c) ? null : c,
    isPro: user.isPro,
    unlimited: false,
  });
}
