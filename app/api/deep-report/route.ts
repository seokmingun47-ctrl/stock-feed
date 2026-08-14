import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getQuote, getValuationContext } from "@/lib/naver";
import { stockNews } from "@/lib/stocknews";
import { aiText } from "@/lib/textai";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const dynamic = "force-dynamic";
export const maxDuration = 40;

// "1,718,000" → 1718000
function num(s: string | null | undefined): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseJson(raw: string): { summary?: string; why?: string[]; risks?: string[] } {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    return {};
  }
}
const arr = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, max) : [];

// 프로 전용 종목 심층 리포트 — 실제 시세·밸류에이션·뉴스만 근거로.
export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ ok: false, reason: "로그인이 필요해요." }, { status: 401 });
  if (!user.isPro) {
    return NextResponse.json(
      { ok: false, reason: "심층 리포트는 프로 기능이에요.", code: "PRO_ONLY" },
      { status: 403 },
    );
  }

  let body: { symbol?: unknown; name?: unknown; domestic?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const symbol = String(body.symbol ?? "").trim();
  const name = String(body.name ?? "").trim().slice(0, 40);
  const domestic = !!body.domestic;
  if (!symbol || !name) {
    return NextResponse.json({ ok: false, reason: "종목 정보가 없어요." }, { status: 400 });
  }

  // 실데이터 3종 병렬
  const [quote, val, news] = await Promise.all([
    getQuote({ symbol, domestic }).catch(() => null),
    getValuationContext(symbol, domestic).catch(() => null),
    stockNews(name, 5).catch(() => []),
  ]);

  // 목표주가 괴리율 (숫자는 코드가 계산 — AI가 만들지 않게)
  const price = quote?.price ?? null;
  const cur = num(price);
  const tgt = num(val?.targetPrice ?? null);
  const targetGap = cur && tgt ? +(((tgt - cur) / cur) * 100).toFixed(1) : null;

  // 뉴스 전역 번호
  const sources: { n: number; title: string; link: string }[] = [];
  const newsLines = news.map((a, i) => {
    sources.push({ n: i + 1, title: a.title, link: a.link });
    return `[뉴스${i + 1}] ${a.title}${a.summary ? " — " + a.summary.slice(0, 120) : ""}`;
  });

  const valLines = [
    `현재가 ${price ?? "?"}${domestic ? "원" : ""}`,
    quote?.changeRate != null ? `등락 ${quote.changeRate}%` : "",
    val?.targetPrice ? `애널리스트 목표주가 평균 ${val.targetPrice}${targetGap != null ? ` (현재가 대비 ${targetGap > 0 ? "+" : ""}${targetGap}%)` : ""}` : "",
    val?.recommMean ? `투자의견 평균 ${val.recommMean} (1=강력매수 · 3=중립 · 5=강력매도)` : "",
    val?.per ? `PER ${val.per}` : "",
    val?.pbr ? `PBR ${val.pbr}` : "",
    val?.high52 && val?.low52 ? `52주 ${val.low52} ~ ${val.high52}` : "",
    val?.marketCap ? `시총 ${val.marketCap}` : "",
    val?.peers?.length ? `동종업계 PER: ${val.peers.map((p) => `${p.name} ${p.per ?? "?"}`).join(", ")}` : "",
  ].filter(Boolean);

  const prompt = `당신은 증권 앱의 '종목 심층 리포트' 작성 도구입니다. 아래 제공된 실제 수치·뉴스만 근거로 쓰고, 없는 숫자·사건·전망을 절대 지어내지 마세요.

[종목] ${name}
[시세·밸류에이션] ← 이 수치만 인용
${valLines.map((l) => "- " + l).join("\n")}

[최근 뉴스] ← 등락/이슈의 유일한 근거
${newsLines.join("\n") || "(관련 뉴스 없음)"}

작성 규칙:
- summary: 이 종목의 현재 상황을 2~3문장으로. 위 수치·뉴스 범위 안에서만.
- why: 최근 왜 오르내렸는지/무슨 이슈인지 2~3개 항목. 각 항목 끝에 반드시 [뉴스N] 인용. 뉴스가 없으면 why는 빈 배열.
- risks: 데이터에서 읽히는 리스크 2~3개 (예: PBR 높음=기대 선반영, 급등 후 변동성, 목표주가 괴리 큼=의견 갈림 등). 없는 리스크 창작 금지.
- 목표주가 괴리·투자의견은 위에 준 값만 사용. "오른다/내린다" 단정, 매수·매도 지시 금지.

아래 JSON만 응답:
{"summary":"...","why":["...[뉴스1]","...[뉴스2]"],"risks":["...","..."]}`;

  const raw = await aiText(prompt, { maxTokens: 900, json: true, timeoutMs: 25000 }).catch(() => null);
  const parsed = raw ? parseJson(raw) : {};

  return NextResponse.json({
    ok: true,
    name,
    price,
    changeRate: quote?.changeRate ?? null,
    currency: quote?.currency ?? (domestic ? "KRW" : "USD"),
    summary: (parsed.summary && String(parsed.summary).trim()) || "실데이터를 불러왔어요. 아래 지표와 뉴스를 확인하세요.",
    why: news.length ? arr(parsed.why, 3) : [],
    risks: arr(parsed.risks, 3),
    valuation: {
      per: val?.per ?? null,
      pbr: val?.pbr ?? null,
      targetPrice: val?.targetPrice ?? null,
      targetGap,
      recommMean: val?.recommMean ?? null,
      high52: val?.high52 ?? null,
      low52: val?.low52 ?? null,
      marketCap: val?.marketCap ?? null,
      peers: val?.peers ?? [],
    },
    sources,
  });
}
