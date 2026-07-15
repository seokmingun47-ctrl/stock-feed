import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { spendCredits } from "@/lib/credits";
import { PRO_PLAN } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 시크릿 키는 서버에서만. 미설정이면 토스 '문서용' 테스트 시크릿 키.
const TOSS_SECRET_KEY =
  process.env.TOSS_SECRET_KEY || "test_gsk_docs_OaPz8L5KdmQXkzRz3y47BMw6";

// 결제 승인 — 클라이언트가 successUrl에서 받은 값을 서버가 토스에 최종 승인 요청.
export async function POST(req: NextRequest) {
  let body: { paymentKey?: unknown; orderId?: unknown; amount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const paymentKey = String(body.paymentKey ?? "").trim();
  const orderId = String(body.orderId ?? "").trim();
  const amount = Number(body.amount);

  if (!paymentKey || !orderId || !Number.isFinite(amount)) {
    return NextResponse.json({ ok: false, reason: "결제 정보가 올바르지 않아요." }, { status: 400 });
  }
  // 금액 변조 방지: 프로 금액만 승인
  if (amount !== PRO_PLAN.amount) {
    return NextResponse.json(
      { ok: false, reason: "결제 금액이 올바르지 않아요." },
      { status: 400 },
    );
  }

  const user = await getUser(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, reason: "로그인이 필요해요.", code: "NO_AUTH" },
      { status: 401 },
    );
  }

  // 토스 결제 승인
  const auth = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
  let payment: Record<string, unknown>;
  try {
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    payment = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          reason: (payment?.message as string) || "결제 승인에 실패했어요.",
          code: (payment?.code as string) || "CONFIRM_FAILED",
        },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, reason: "결제 서버에 연결하지 못했어요." },
      { status: 502 },
    );
  }

  // 승인 성공 → 프로 활성화 + 크레딧 충전 (마이그레이션 전이면 각각 그레이스풀)
  let credited = false;
  if (isSupabaseConfigured()) {
    const db = getAdminClient();
    try {
      await db.from("community_users").update({ is_pro: true }).eq("id", user.id);
    } catch {
      /* is_pro 컬럼 미설정 */
    }
    const bal = await spendCredits(db, user.id, -PRO_PLAN.credits); // 음수 = 충전
    credited = !Number.isNaN(bal);
    // 결제 기록 (payments 테이블 없으면 무시)
    try {
      await db.from("payments").insert({
        user_id: user.id,
        order_id: orderId,
        payment_key: paymentKey,
        amount,
        status: String(payment.status ?? "DONE"),
      });
    } catch {
      /* payments 테이블 미설정 */
    }
  }

  return NextResponse.json({
    ok: true,
    orderId,
    amount,
    credited,
    addedCredits: PRO_PLAN.credits,
    approvedAt: payment.approvedAt ?? null,
  });
}
