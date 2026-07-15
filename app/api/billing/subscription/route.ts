import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 내 구독 상태
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, subscription: null });
  const db = getAdminClient();
  try {
    const { data } = await db
      .from("subscriptions")
      .select("status, next_charge_at, amount")
      .eq("user_id", user.id)
      .maybeSingle();
    return NextResponse.json({ ok: true, subscription: data ?? null });
  } catch {
    return NextResponse.json({ ok: true, subscription: null });
  }
}

// 구독 해지 (기간 종료까지는 프로 유지, 이후 갱신 안 됨)
export async function DELETE(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  const db = getAdminClient();
  try {
    const { data } = await db
      .from("subscriptions")
      .update({ status: "canceled" })
      .eq("user_id", user.id)
      .in("status", ["active", "past_due"])
      .select("next_charge_at")
      .maybeSingle();
    return NextResponse.json({ ok: true, until: data?.next_charge_at ?? null });
  } catch {
    return NextResponse.json({ ok: false, reason: "구독 정보를 찾지 못했어요." }, { status: 404 });
  }
}
