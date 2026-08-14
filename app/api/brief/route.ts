import { NextRequest, NextResponse } from "next/server";
import { getAdminClient, isSupabaseConfigured } from "@/lib/supabase";
import { getUser } from "@/lib/auth";
import { getIndices, getQuote } from "@/lib/naver";
import { getEconEvents } from "@/lib/econ";
import { stockNews } from "@/lib/stocknews";
import { aiText } from "@/lib/textai";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

interface Watch {
  name?: string;
  symbol?: string;
  domestic?: boolean;
}

const US_INDEX = ["다우존스", "S&P 500", "나스닥"];

function todayKST(): string {
  // KST(UTC+9) 기준 오늘 날짜
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10);
}

// 브리핑 켜기/끄기
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  if (!user.isPro) {
    return NextResponse.json(
      { ok: false, reason: "아침 브리핑은 프로 기능이에요.", code: "PRO_ONLY" },
      { status: 403 },
    );
  }
  let on = false;
  try {
    on = !!(await req.json())?.on;
  } catch {
    /* on=false */
  }
  const db = getAdminClient();
  const { error } = await db.from("community_users").update({ brief_on: on }).eq("id", user.id);
  if (error) {
    return NextResponse.json(
      { ok: false, reason: "브리핑 설정 컬럼이 없어요. supabase/brief-schema.sql 을 실행해주세요." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, briefOn: on });
}

interface StockInfo {
  name: string;
  changeRate: number | null;
  news: { title: string; link: string; summary?: string }[];
}

function parseReasons(raw: string): { summary?: string; stocks?: { name: string; reason: string }[] } {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    return {};
  }
}

// 브리핑 생성(클릭 시 실시간 생성 — 항상 최신, 실제 데이터·뉴스만)
export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });

  // 1) 관심종목 로드
  let watch: Watch[] = [];
  if (isSupabaseConfigured()) {
    const db = getAdminClient();
    const { data } = await db
      .from("community_users")
      .select("watchlist")
      .eq("id", user.id)
      .single();
    const wl = (data as { watchlist?: unknown })?.watchlist;
    if (Array.isArray(wl)) watch = wl as Watch[];
  }

  // 2) 실제 데이터 수집 (병렬): 미국지수 · 경제일정 · 관심종목별(시세+뉴스)
  const day = todayKST();
  const watchTop = watch.slice(0, 5);
  const [indicesAll, econ, perStock] = await Promise.all([
    getIndices().catch(() => []),
    getEconEvents(day, day, "ko").catch(() => ({ events: [] as never[] })),
    Promise.all(
      watchTop.map(async (w): Promise<StockInfo> => {
        const nm = w.name || w.symbol || "";
        const [q, news] = await Promise.all([
          w.symbol ? getQuote({ symbol: w.symbol, domestic: !!w.domestic }).catch(() => null) : null,
          stockNews(nm, 4).catch(() => []),
        ]);
        return {
          name: nm,
          changeRate: q?.changeRate ?? null,
          news: news.map((a) => ({ title: a.title, link: a.link, summary: a.summary })),
        };
      }),
    ),
  ]);

  const usIndices = indicesAll.filter((i) => US_INDEX.includes(i.name));
  const events = (econ.events as { title: string; country: string; impact: number; date: string }[])
    .filter((e) => e.impact >= 2)
    .slice(0, 6);

  // 3) 뉴스에 전역 번호 부여([뉴스N]) — AI가 인용할 유일한 근거
  const sources: { n: number; title: string; link: string }[] = [];
  let counter = 0;
  const stockBlocks = perStock.map((s) => {
    const lines = s.news.map((a) => {
      counter++;
      sources.push({ n: counter, title: a.title, link: a.link });
      return `[뉴스${counter}] ${a.title}${a.summary ? " — " + a.summary.slice(0, 120) : ""}`;
    });
    return `● ${s.name} (${s.changeRate ?? "?"}%)\n${lines.length ? lines.join("\n") : "(관련 뉴스 없음)"}`;
  });

  const idxTxt = usIndices.length
    ? usIndices.map((i) => `${i.name} ${i.changeRate ?? "?"}%`).join(", ")
    : "데이터 없음";
  const evTxt = events.length
    ? events.map((e) => `${e.title}(${e.country})`).join(", ")
    : "주요 일정 없음";

  const prompt = `당신은 증권 앱 '아침 브리핑' 작성 도구입니다. 아래 제공된 실제 수치·뉴스만 사용하고, 없는 내용을 절대 지어내지 마세요.

[미국 증시 마감] ${idxTxt}
[오늘 주요 경제일정] ${evTxt}

[관심종목별 등락과 관련 뉴스]
${stockBlocks.join("\n\n") || "관심종목 없음"}

규칙:
- 각 관심종목마다 "왜 올랐/내렸는지"를 위 [뉴스N]에 근거해 1~2문장으로 설명하고, 반드시 [뉴스N] 형식으로 인용.
- 해당 종목이 "관련 뉴스 없음"이면 이유를 지어내지 말고 reason에 "관련 뉴스가 없어 이유를 특정하기 어려워요"라고만 쓸 것.
- 없는 숫자·사건·전망을 만들지 말 것. 투자 권유·매수매도 지시 금지.
- summary: 아침 인사 + 미국장/일정 한두 줄 요약.

아래 JSON만 응답:
{"summary":"...","stocks":[{"name":"종목명","reason":"...[뉴스1]..."}]}`;

  const raw =
    watchTop.length || usIndices.length
      ? await aiText(prompt, { maxTokens: 900, json: true, timeoutMs: 25000 }).catch(() => null)
      : null;
  const parsed = raw ? parseReasons(raw) : {};

  const reasonMap = new Map<string, string>();
  for (const s of parsed.stocks ?? []) {
    if (s?.name) reasonMap.set(String(s.name).trim(), String(s.reason ?? "").trim());
  }

  // 근거 안전장치: 뉴스가 없는 종목은 AI가 뭐라 했든 정직한 문구로 고정.
  const watchOut = perStock.map((s) => ({
    name: s.name,
    changeRate: s.changeRate,
    reason: s.news.length
      ? reasonMap.get(s.name) || "관련 뉴스를 찾았지만 등락과의 연결은 분명하지 않아요."
      : "관련 뉴스가 없어 이유를 특정하기 어려워요.",
  }));

  const summary =
    (parsed.summary && String(parsed.summary).trim()) ||
    "오늘의 시장 데이터를 불러왔어요. 아래 종목별 설명을 확인하세요.";

  return NextResponse.json({
    ok: true,
    date: day,
    name: user.username,
    summary,
    usIndices: usIndices.map((i) => ({ name: i.name, changeRate: i.changeRate })),
    watch: watchOut,
    events: events.map((e) => ({ title: e.title, country: e.country })),
    sources,
  });
}
