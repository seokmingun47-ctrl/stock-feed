import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { sendEmail, emailConfigured, briefEmailHtml } from "@/lib/email";
import { isAdminUsername } from "@/lib/auth";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://newsync.app";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  return auth === `Bearer ${secret}` || key === secret;
}

// 매일 아침(KST 7시) 1회 호출 → 브리핑 켠 프로 유저에게 안내 메일 발송.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, reason: "no-db" }, { status: 503 });
  }
  if (!emailConfigured()) {
    return NextResponse.json({ ok: false, reason: "email not configured" }, { status: 503 });
  }

  const db = getAdminClient();
  let users: Array<Record<string, unknown>> = [];
  try {
    // 브리핑을 켠 사람만(켜기 자체가 프로 전용이라 안전). 어드민은 DB is_pro가
    // false여도 포함(관리자 프로는 런타임 판정이라). 프로가 만료된 사람은 제외.
    const { data } = await db
      .from("community_users")
      .select("id, username, email, is_pro, brief_on")
      .eq("brief_on", true)
      .limit(1000);
    users = (data ?? []).filter(
      (u) => u.is_pro || isAdminUsername(String(u.username ?? "")),
    );
  } catch {
    return NextResponse.json({ ok: false, reason: "brief_on 컬럼 미설정" }, { status: 503 });
  }

  const summary = { total: users.length, sent: 0, failed: 0, skipped: 0 };
  const url = `${SITE}/brief`;

  for (const u of users) {
    const email = String(u.email ?? "").trim();
    if (!email || !email.includes("@")) {
      summary.skipped++;
      continue;
    }
    const r = await sendEmail({
      to: email,
      subject: "오늘의 브리핑이 준비됐어요 · Newsync",
      html: briefEmailHtml({ name: String(u.username ?? "회원"), url }),
    });
    if (r.ok) summary.sent++;
    else summary.failed++;
  }

  return NextResponse.json({ ok: true, ...summary });
}
