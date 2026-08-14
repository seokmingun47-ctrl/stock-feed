import { NextRequest, NextResponse } from "next/server";
import { aiFromGeminiBody } from "@/lib/textai";
import { chargeAI } from "@/lib/credits";
import { fetchSource } from "@/lib/rss";
import { translateMany } from "@/lib/translate";
import { SOURCE_MAP } from "@/lib/sources";
import { getChart, getIndexQuote, type Candle, type IndexQuote, type Resolved } from "@/lib/naver";
import type { Article, Source } from "@/lib/types";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

interface MoverReason {
  summary: string;
  points: string[]; // 각 항목에 [뉴스N] 인용 필수
  watch: string[]; // 앞으로 확인할 일정·변수 (역시 [뉴스N] 인용 필수)
}

async function fetchQuery(q: string, limit: number): Promise<Article[]> {
  const base = SOURCE_MAP["gnews_kr"];
  if (!base) return [];
  const src: Source = {
    ...base,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`,
  };
  try {
    return (await fetchSource(src)).slice(0, limit);
  } catch {
    return [];
  }
}

// 급등/급락 사유는 반드시 '실제 뉴스'에 근거해야 한다 (모델 추측 금지).
// 설명이 빈약한 가장 큰 원인은 모델이 아니라 '재료 부족'이라서 질의를 나눠 던진다.
//  ① 주가 움직임 자체를 다룬 기사  ② 그 원인이 될 만한 기업 이벤트(실적·수주·공시…)
async function moverNews(name: string): Promise<Article[]> {
  const [move, event] = await Promise.all([
    fetchQuery(`${name} (주가 OR 급등 OR 급락 OR 상승 OR 하락) when:3d`, 8),
    fetchQuery(
      `${name} (실적 OR 수주 OR 계약 OR 공시 OR 인수 OR 승인 OR 특허 OR 리콜 OR 소송 OR 목표주가) when:7d`,
      6,
    ),
  ]);
  // 같은 기사가 두 질의에 다 걸리므로 링크로 중복 제거
  const seen = new Set<string>();
  let arts: Article[] = [];
  for (const a of [...move, ...event]) {
    const k = a.link || a.title;
    if (!k || seen.has(k)) continue;
    seen.add(k);
    arts.push(a);
  }
  arts = arts.slice(0, 12);
  if (arts.length) {
    try {
      const texts: string[] = [];
      for (const a of arts) texts.push(a.title, a.summary || "");
      const tr = await translateMany(texts);
      let i = 0;
      for (const a of arts) {
        a.title = tr[i++] || a.title;
        a.summary = tr[i++] || a.summary;
      }
    } catch {
      /* 번역 실패해도 원문 사용 */
    }
  }
  return arts;
}

/**
 * 시세에서 '계산'으로 뽑아내는 사실들. AI를 거치지 않으므로 틀릴 수가 없다.
 * 뉴스가 빈약할 때도 이건 항상 채워지므로 화면이 초라해지지 않는다.
 */
interface MoverContext {
  label: string;
  value: string;
  hint?: string;
}

function buildContext(
  candles: Candle[] | null,
  index: IndexQuote | null,
  changeRate: number,
): MoverContext[] {
  const out: MoverContext[] = [];

  // 1) 시장 전체 대비 — '이 종목만의 일'인지 가리는 가장 중요한 단서
  if (index && index.changeRate !== 0) {
    const gap = changeRate - index.changeRate;
    out.push({
      label: `${index.name} 대비`,
      value: `${gap > 0 ? "+" : ""}${gap.toFixed(2)}%p`,
      hint:
        Math.abs(index.changeRate) >= 1 && gap * index.changeRate > 0
          ? `${index.name}도 ${index.changeRate > 0 ? "+" : ""}${index.changeRate.toFixed(2)}% — 시장 전체 흐름이 함께 작용했어요`
          : `${index.name}는 ${index.changeRate > 0 ? "+" : ""}${index.changeRate.toFixed(2)}%`,
    });
  }

  if (!candles || candles.length < 2) return out;
  const last = candles[candles.length - 1];

  // 2) 거래량 — 재료가 실제로 있었는지 보여주는 지표
  const prev = candles.slice(-21, -1);
  const avg = prev.length ? prev.reduce((s, c) => s + c.v, 0) / prev.length : 0;
  if (avg > 0 && last.v > 0) {
    const x = last.v / avg;
    out.push({
      label: "거래량",
      value: `평소의 ${x.toFixed(1)}배`,
      hint:
        x >= 3
          ? "평소보다 훨씬 많은 손바뀜이 있었어요"
          : x >= 1.5
            ? "거래가 평소보다 늘었어요"
            : "거래량은 평소와 비슷해요",
    });
  }

  // 3) 최근 흐름 — 오늘 갑자기인지, 며칠째인지
  const recent = candles.slice(-6);
  if (recent.length >= 6) {
    const from = recent[0].c;
    const pct = ((last.c - from) / from) * 100;
    const ups = recent.slice(1).filter((c, i) => c.c > recent[i].c).length;
    // 방향(연속성)과 크기를 함께 봐야 한다.
    // 등락일이 엇갈려도 누적 낙폭이 크면 '엇갈렸다'고만 쓰면 오해를 준다.
    const streak =
      ups >= 4
        ? "5일 중 4일 이상 올랐어요"
        : ups <= 1
          ? "5일 중 4일 이상 내렸어요"
          : "등락일이 엇갈렸지만";
    out.push({
      label: "최근 5거래일",
      value: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
      hint:
        Math.abs(pct) >= 5
          ? `${streak} 5일 누적 ${pct > 0 ? "+" : ""}${pct.toFixed(1)}% — 오늘만의 움직임이 아니에요`
          : `${streak} 5일 누적으로는 큰 변화가 없어요`,
    });
  }

  // 4) 기간 고저 대비 위치
  const hi = Math.max(...candles.map((c) => c.h));
  const lo = Math.min(...candles.map((c) => c.l));
  if (hi > lo) {
    const pos = ((last.c - lo) / (hi - lo)) * 100;
    const days = candles.length;
    out.push({
      label: `최근 ${days}일 구간`,
      value: `${pos.toFixed(0)}% 지점`,
      hint:
        pos >= 90
          ? "구간 최고가 부근이에요"
          : pos <= 10
            ? "구간 최저가 부근이에요"
            : `최고 ${hi.toLocaleString()} · 최저 ${lo.toLocaleString()}`,
    });
  }

  // 5) 장중 변동폭 — 하루 안에서 얼마나 출렁였는지
  if (last.h > last.l && last.o > 0) {
    const range = ((last.h - last.l) / last.o) * 100;
    out.push({
      label: "장중 변동폭",
      value: `${range.toFixed(1)}%`,
      hint: `고가 ${last.h.toLocaleString()} · 저가 ${last.l.toLocaleString()}`,
    });
  }

  return out;
}

function buildPrompt(
  name: string,
  dir: "up" | "down",
  changeRate: number,
  news: Article[],
  context: MoverContext[],
): string {
  const word = dir === "up" ? "급등" : "급락";
  const newsBlock = news.length
    ? news
        .map(
          (a, i) =>
            `[뉴스${i + 1}] ${a.title}${a.summary ? `\n  요약: ${a.summary.slice(0, 200)}` : ""}`,
        )
        .join("\n")
    : "(관련 뉴스 없음)";

  const ctxBlock = context.length
    ? context.map((c) => `- ${c.label}: ${c.value}${c.hint ? ` (${c.hint})` : ""}`).join("\n")
    : "(시세 지표 없음)";

  return `당신은 '제공된 자료'만 정리하는 도구입니다. 아래 [최근 뉴스]와 [시세 지표]에 실제로 있는 내용 외에는 어떤 사실·원인·전망도 쓰지 마세요. 당신의 배경지식으로 추측하지 마세요.

[종목] ${name}
[오늘 등락률] ${changeRate > 0 ? "+" : ""}${changeRate.toFixed(2)}% (${word})

[시세 지표] ← 이미 계산된 사실. 해석에 참고하되 숫자를 바꾸지 말 것
${ctxBlock}

[최근 뉴스] ← 오직 이 안에 있는 내용만 사용
${newsBlock}

이 종목이 오늘 ${word}한 이유를 위 자료에서 찾아 설명하세요.

규칙(반드시 지킬 것):
- **[최근 뉴스]에 문장으로 실제 존재하는 내용만** 쓸 것.
- points의 각 항목 끝에 근거 뉴스 번호를 반드시 붙일 것. 예) "3분기 영업이익이 시장 예상을 웃돌았다 [뉴스2]"
- points는 사유를 **구체적으로** 쓸 것. 숫자·기관명·제품명이 뉴스에 있으면 그대로 포함할 것.
  나쁜 예) "실적이 좋았다 [뉴스1]"  좋은 예) "3분기 영업이익 1조2천억원으로 전년 대비 40% 증가 [뉴스1]"
- summary는 2~3문장. 오늘 움직임의 성격(시장 전체 흐름인지 이 종목만의 재료인지)을 [시세 지표] 근거로 언급할 것.
- watch에는 **뉴스에 실제로 언급된** 앞으로의 일정·변수만 쓸 것(실적 발표일, 승인 심사, 계약 예정 등). 각 항목에 [뉴스N] 필수.
  예측이 아니라 "뉴스에 이런 일정이 언급됐다"는 사실만. 없으면 빈 배열 [].
- 뉴스에 ${word} 사유가 없으면 **points를 빈 배열 []로 두고**, summary에 "관련 뉴스에서 뚜렷한 사유를 찾지 못했어요"라고 쓴 뒤 [시세 지표]로 관찰된 사실만 덧붙일 것.
  억지로 지어내지 말 것. 빈 배열이 틀린 내용보다 낫다.
- 주가 예측·투자 권유("오를 것/사라/목표가") 금지. 이미 보도된 사실만.
- 뉴스가 이 종목과 무관하면 사용하지 말 것.

아래 JSON만 응답:
{"summary":"2~3문장 요약","points":["구체적 사유 [뉴스N]","..."],"watch":["뉴스에 언급된 향후 일정 [뉴스N]","..."]}`;
}

// 인용이 없거나 존재하지 않는 뉴스를 가리키는 항목은 지어낸 것으로 보고 폐기한다.
function citedOnly(v: unknown, newsCount: number, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((p) => String(p).trim())
    .filter((p) => {
      if (!p) return false;
      const m = p.match(/\[뉴스\s*(\d+)\]/);
      if (!m) return false;
      const n = Number(m[1]);
      return n >= 1 && n <= newsCount;
    })
    .slice(0, max);
}

function parse(raw: string, newsCount: number): MoverReason | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as {
      summary?: unknown;
      points?: unknown;
      watch?: unknown;
    };
    const summary = String(o.summary ?? "").trim().slice(0, 600);
    const points = citedOnly(o.points, newsCount, 6);
    const watch = citedOnly(o.watch, newsCount, 3);
    if (!summary && !points.length) return null;
    return { summary, points, watch };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "no-key" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 40);
  const dir: "up" | "down" = body.dir === "down" ? "down" : "up";
  const changeRate = Number(body.changeRate);
  if (!name) {
    return NextResponse.json({ ok: false, reason: "종목 정보가 없어요." }, { status: 400 });
  }

  // 급등·급락 사유는 무료 플랜도 크레딧으로 이용할 수 있다(프로 전용 아님).
  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  const rate = Number.isFinite(changeRate) ? changeRate : 0;
  const symbol = String(body.symbol ?? "").trim();
  const domestic = body.domestic !== false;

  // 뉴스·차트·지수를 한꺼번에 (하나가 실패해도 나머지는 살린다)
  const [news, candles, index] = await Promise.all([
    moverNews(name),
    symbol
      ? getChart({ symbol, domestic } as Resolved, "day").catch(() => null)
      : Promise.resolve(null),
    getIndexQuote(
      domestic ? (String(body.market) === "KOSDAQ" ? "KOSDAQ" : "KOSPI") : "NASDAQ",
    ).catch(() => null),
  ]);
  const context = buildContext(candles, index, rate);

  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: buildPrompt(name, dir, rate, news, context) }],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      maxOutputTokens: 900,
    },
  });
  const out = await aiFromGeminiBody(requestBody);
  if (!out) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
  const reason = parse(out, news.length);
  if (!reason) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI 응답을 해석하지 못했어요." }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    dir,
    reason,
    news,
    context, // AI를 거치지 않은 계산 결과
    credits: charge.credits,
  });
}
