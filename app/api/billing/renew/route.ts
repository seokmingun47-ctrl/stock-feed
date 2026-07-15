import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { spendCredits } from "@/lib/credits";
import { chargeBilling } from "@/lib/toss";
import { PRO_PLAN } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FAILS = 3;

// 매일 크론이 호출: 결제일이 된 구독을 자동 청구. 해지된 구독은 기간 만료 처리.
export async function GET(req: NextRequest) {
  // CRON_SECRET이 설정돼 있으면 인증 요구 (Vercel 크론이 Bearer로 보냄)
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const key = req.nextUrl.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }

  const db = getAdminClient();
  const nowIso = new Date().toISOString();
  const summary = { charged: 0, failed: 0, expired: 0 };

  // 1) 청구 대상: active/past_due 이고 결제일 도래
  let due: Array<Record<string, unknown>> = [];
  try {
    const { data } = await db
      .from("subscriptions")
      .select("*")
      .in("status", ["active", "past_due"])
      .lte("next_charge_at", nowIso)
      .limit(500);
    due = data ?? [];
  } catch {
    return NextResponse.json({ ok: false, reason: "subscriptions 테이블 미설정" }, { status: 503 });
  }

  for (const s of due) {
    const userId = String(s.user_id);
    const billingKey = String(s.billing_key);
    const customerKey = String(s.customer_key);
    const orderId = `newsync-renew-${userId.slice(0, 8)}-${Date.now()}`;
    const res = await chargeBilling(billingKey, {
      customerKey,
      amount: PRO_PLAN.amount,
      orderId,
      orderName: PRO_PLAN.orderName,
    });
    if (res.ok) {
      const next = new Date();
      next.setMonth(next.getMonth() + 1);
      await db
        .from("subscriptions")
        .update({
          status: "active",
          last_charged_at: nowIso,
          next_charge_at: next.toISOString(),
          fail_count: 0,
        })
        .eq("user_id", userId);
      await db.from("community_users").update({ is_pro: true }).eq("id", userId);
      await spendCredits(db, userId, -PRO_PLAN.credits);
      try {
        await db.from("payments").insert({
          user_id: userId,
          order_id: orderId,
          payment_key: String(res.data.paymentKey ?? ""),
          amount: PRO_PLAN.amount,
          kind: "renewal",
          status: String(res.data.status ?? "DONE"),
        });
      } catch {
        /* noop */
      }
      summary.charged++;
    } else {
      const fails = Number(s.fail_count ?? 0) + 1;
      const giveUp = fails >= MAX_FAILS;
      await db
        .from("subscriptions")
        .update({
          status: giveUp ? "past_due" : "active",
          fail_count: fails,
          // 실패 시 하루 뒤 재시도
          next_charge_at: giveUp ? s.next_charge_at : new Date(Date.now() + 864e5).toISOString(),
        })
        .eq("user_id", userId);
      if (giveUp) {
        await db.from("community_users").update({ is_pro: false }).eq("id", userId);
      }
      summary.failed++;
    }
  }

  // 2) 해지 구독 만료: canceled 이고 기간 종료 → 프로 해제
  try {
    const { data: expired } = await db
      .from("subscriptions")
      .select("user_id")
      .eq("status", "canceled")
      .lte("next_charge_at", nowIso)
      .limit(500);
    for (const e of expired ?? []) {
      await db.from("community_users").update({ is_pro: false }).eq("id", String(e.user_id));
      await db.from("subscriptions").update({ status: "ended" }).eq("user_id", String(e.user_id));
      summary.expired++;
    }
  } catch {
    /* noop */
  }

  return NextResponse.json({ ok: true, ...summary });
}
