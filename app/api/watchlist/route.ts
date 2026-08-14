import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WatchItem {
  name: string;
  ticker: string;
  symbol: string;
  market?: string;
  domestic: boolean;
}

function clean(arr: unknown): WatchItem[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        name: String(o.name ?? "").slice(0, 40),
        ticker: String(o.ticker ?? "").slice(0, 20),
        symbol: String(o.symbol ?? "").slice(0, 20),
        market: o.market ? String(o.market).slice(0, 20) : undefined,
        domestic: !!o.domestic,
      };
    })
    .filter((x) => x.symbol)
    .slice(0, 100); // 상한
}

// 내 관심종목 불러오기 (미설정/컬럼없음이면 null → 클라가 로컬 유지)
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, watchlist: null });
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: true, watchlist: null });
  const db = getAdminClient();
  // brief_on 컬럼이 없을 수도 있어 폴백
  let data: Record<string, unknown> | null = null;
  const full = await db
    .from("community_users")
    .select("watchlist, alerts_on, brief_on")
    .eq("id", user.id)
    .single();
  if (full.error) {
    const basic = await db
      .from("community_users")
      .select("watchlist, alerts_on")
      .eq("id", user.id)
      .single();
    if (basic.error) return NextResponse.json({ ok: true, watchlist: null });
    data = basic.data as Record<string, unknown>;
  } else {
    data = full.data as Record<string, unknown>;
  }
  return NextResponse.json({
    ok: true,
    watchlist: clean(data?.watchlist),
    alertsOn: !!data?.alerts_on,
    briefOn: !!data?.brief_on,
  });
}

// 관심종목 저장(전체 배열 교체). 로그인 필수.
export async function PUT(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  let body: { watchlist?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const list = clean(body.watchlist);
  const db = getAdminClient();
  const { error } = await db
    .from("community_users")
    .update({ watchlist: list })
    .eq("id", user.id);
  if (error) {
    // watchlist 컬럼 미설정 등 — 실패해도 클라는 로컬로 동작
    return NextResponse.json({ ok: false, reason: "not-ready" }, { status: 200 });
  }
  return NextResponse.json({ ok: true, count: list.length });
}
