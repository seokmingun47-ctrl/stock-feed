import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { spendCredits } from "@/lib/credits";
import { issueBillingKey, chargeBilling } from "@/lib/toss";
import { PRO_PLAN } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 카드 등록(빌링키 발급) → 첫 달 결제 → 구독 생성 + 프로 활성화
export async function POST(req: NextRequest) {
  let body: { authKey?: unknown; customerKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const authKey = String(body.authKey ?? "").trim();
  const customerKey = String(body.customerKey ?? "").trim();
  if (!authKey || !customerKey) {
    return NextResponse.json({ ok: false, reason: "결제 정보가 없어요." }, { status: 400 });
  }

  const user = await getUser(req);
  if (!user) {
    return NextResponse.json({ ok: false, reason: "로그인이 필요해요.", code: "NO_AUTH" }, { status: 401 });
  }
  // customerKey 소유자 확인 (남의 authKey 승인 방지)
  if (customerKey !== `user_${user.id}`) {
    return NextResponse.json({ ok: false, reason: "결제 정보가 일치하지 않아요." }, { status: 400 });
  }

  // 1) 빌링키 발급
  const issued = await issueBillingKey(authKey, customerKey);
  if (!issued.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: (issued.data?.message as string) || "카드 등록에 실패했어요.",
        code: (issued.data?.code as string) || "BILLING_ISSUE_FAILED",
      },
      { status: 400 },
    );
  }
  const billingKey = String(issued.data.billingKey ?? "");
  if (!billingKey) {
    return NextResponse.json({ ok: false, reason: "빌링키를 받지 못했어요." }, { status: 502 });
  }

  // 2) 첫 달 결제
  const orderId = `newsync-sub-${user.id.slice(0, 8)}-${Date.now()}`;
  const charged = await chargeBilling(billingKey, {
    customerKey,
    amount: PRO_PLAN.amount,
    orderId,
    orderName: PRO_PLAN.orderName,
    customerName: user.username,
  });
  if (!charged.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: (charged.data?.message as string) || "첫 결제에 실패했어요.",
        code: (charged.data?.code as string) || "CHARGE_FAILED",
      },
      { status: 400 },
    );
  }

  // 3) 구독 생성 + 프로 + 크레딧 (마이그레이션 전이면 그레이스풀)
  let stored = false;
  if (isSupabaseConfigured()) {
    const db = getAdminClient();
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    try {
      await db.from("subscriptions").upsert(
        {
          user_id: user.id,
          customer_key: customerKey,
          billing_key: billingKey,
          status: "active",
          amount: PRO_PLAN.amount,
          last_charged_at: new Date().toISOString(),
          next_charge_at: next.toISOString(),
          fail_count: 0,
        },
        { onConflict: "user_id" },
      );
      stored = true;
    } catch {
      /* subscriptions 테이블 미설정 */
    }
    try {
      await db.from("community_users").update({ is_pro: true }).eq("id", user.id);
    } catch {
      /* is_pro 컬럼 미설정 */
    }
    await spendCredits(db, user.id, -PRO_PLAN.credits);
    try {
      await db.from("payments").insert({
        user_id: user.id,
        order_id: orderId,
        payment_key: String(charged.data.paymentKey ?? ""),
        amount: PRO_PLAN.amount,
        kind: "subscription",
        status: String(charged.data.status ?? "DONE"),
      });
    } catch {
      /* payments 테이블 미설정 */
    }
  }

  return NextResponse.json({ ok: true, addedCredits: PRO_PLAN.credits, stored });
}
