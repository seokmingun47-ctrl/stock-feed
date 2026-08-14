import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const TREND_DAYS = 14;

// 아직 만들지 않은 테이블/컬럼이 있어도 대시보드 전체가 죽지 않도록 개별 쿼리를 감싼다.
async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

/** 조건 없는 행 수. 테이블이 없으면 null. */
async function countAll(db: SupabaseClient, table: string): Promise<number | null> {
  return safe(async () => {
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return count ?? 0;
  });
}

/** eq 조건 한 개짜리 행 수. */
async function countWhere(
  db: SupabaseClient,
  table: string,
  column: string,
  value: string | boolean,
): Promise<number | null> {
  return safe(async () => {
    const { count, error } = await db
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, value);
    if (error) throw new Error(error.message);
    return count ?? 0;
  });
}

export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  const me = await getUser(req);
  if (!me || !me.isAdmin) {
    return NextResponse.json(
      { ok: false, reason: "관리자만 볼 수 있어요." },
      { status: 403 },
    );
  }

  const db = getAdminClient();
  const now = Date.now();

  // ── 가입자: 가입일 목록을 한 번만 읽어 총계·기간별·추이를 모두 계산 ──
  const signupTimes = await safe(async () => {
    const { data, error } = await db
      .from("community_users")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((r) => (r.created_at ? Date.parse(String(r.created_at)) : 0))
      .filter((t) => t > 0);
  });

  // created_at 컬럼이 없는 경우에도 총원은 세어 둔다.
  const totalUsers = (await countAll(db, "community_users")) ?? signupTimes?.length ?? 0;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  const since = (ms: number) =>
    signupTimes ? signupTimes.filter((t) => t >= ms).length : null;

  // 최근 14일 일별 가입 추이 (오래된 → 최신)
  const trend: { date: string; count: number }[] = [];
  if (signupTimes) {
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      const from = todayMs - i * DAY;
      const to = from + DAY;
      const d = new Date(from);
      trend.push({
        date: `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`,
        count: signupTimes.filter((t) => t >= from && t < to).length,
      });
    }
  }

  // ── 프로 회원 ──
  const pro = await countWhere(db, "community_users", "is_pro", true);

  // ── 기능 사용 (아침 브리핑·관심종목 알림·광고 리워드·웹푸시) ──
  const adoption = {
    brief: await countWhere(db, "community_users", "brief_on", true),
    alerts: await countWhere(db, "community_users", "alerts_on", true),
    adRewards: await countAll(db, "ad_rewards"),
    push: await countAll(db, "push_subscriptions"),
  };

  // ── AI 크레딧 ──
  const credits = await safe(async () => {
    const { data, error } = await db
      .from("community_users")
      .select("credits")
      .limit(5000);
    if (error) throw new Error(error.message);
    const vals = (data ?? [])
      .map((r) => Number(r.credits))
      .filter((n) => Number.isFinite(n));
    if (!vals.length) return { sum: 0, avg: 0, low: 0 };
    const sum = vals.reduce((a, b) => a + b, 0);
    return {
      sum,
      avg: Math.round(sum / vals.length),
      low: vals.filter((v) => v < 100).length, // 소진 임박
    };
  });

  // ── 구독 ──
  const subs = await safe(async () => {
    const { data, error } = await db
      .from("subscriptions")
      .select("status, next_charge_at, amount")
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, unknown>[];
    const byStatus = (s: string) =>
      rows.filter((r) => String(r.status ?? "") === s).length;
    const weekAhead = now + 7 * DAY;
    return {
      active: byStatus("active"),
      canceled: byStatus("canceled"),
      pastDue: byStatus("past_due"),
      dueIn7d: rows.filter((r) => {
        if (String(r.status ?? "") !== "active" || !r.next_charge_at) return false;
        const t = Date.parse(String(r.next_charge_at));
        return t > 0 && t <= weekAhead;
      }).length,
      mrr: rows
        .filter((r) => String(r.status ?? "") === "active")
        .reduce((a, r) => a + (Number(r.amount) || 0), 0),
    };
  });

  // ── 결제 ──
  const revenue = await safe(async () => {
    const { data, error } = await db
      .from("payments")
      .select("amount, status, created_at")
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, unknown>[];
    const done = rows.filter((r) => String(r.status ?? "DONE") === "DONE");
    const amt = (r: Record<string, unknown>) => Number(r.amount) || 0;
    const monthAgo = now - 30 * DAY;
    return {
      count: done.length,
      total: done.reduce((a, r) => a + amt(r), 0),
      last30: done
        .filter((r) => {
          const t = r.created_at ? Date.parse(String(r.created_at)) : 0;
          return t >= monthAgo;
        })
        .reduce((a, r) => a + amt(r), 0),
    };
  });

  // ── 신고 ──
  const reportsTotal = await countAll(db, "reports");
  const reportsPending = await countWhere(db, "reports", "status", "pending");

  // ── 커뮤니티 ──
  const community = {
    posts: await countAll(db, "community_posts"),
    comments: await countAll(db, "community_comments"),
    newsComments: await countAll(db, "news_comments"),
  };

  return NextResponse.json({
    ok: true,
    generatedAt: now,
    users: {
      total: totalUsers,
      today: since(todayMs),
      d7: since(now - 7 * DAY),
      d30: since(now - 30 * DAY),
      pro,
    },
    trend,
    adoption,
    credits,
    subs,
    revenue,
    reports:
      reportsTotal === null && reportsPending === null
        ? null
        : { total: reportsTotal ?? 0, pending: reportsPending ?? 0 },
    community,
  });
}
