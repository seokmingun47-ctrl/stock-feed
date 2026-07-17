import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";
import { chargeAI } from "@/lib/credits";
import { getValuationContext, type ValuationContext } from "@/lib/naver";
import { getUser } from "@/lib/auth";
import { fetchSource } from "@/lib/rss";
import { translateMany } from "@/lib/translate";
import { SOURCE_MAP } from "@/lib/sources";
import type { Article, Source } from "@/lib/types";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

interface Reason {
  summary: string;
  points: string[];
  tech: string[]; // 기술력·사업 근거 (제공된 뉴스에 실제로 있는 내용만)
}

// 기술력 설명은 모델의 기억/추측이 아니라 '실제 뉴스'에만 근거해야 한다.
// 그래서 종목명으로 구글뉴스를 검색해 원문 헤드라인+요약을 그대로 넣어준다.
async function techNews(name: string): Promise<Article[]> {
  const base = SOURCE_MAP["gnews_kr"];
  if (!base) return [];
  const src: Source = {
    ...base,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${name} (기술 OR 실적 OR 수주 OR 개발 OR 사업)`,
    )}&hl=ko&gl=KR&ceid=KR:ko`,
  };
  let arts: Article[] = [];
  try {
    arts = (await fetchSource(src)).slice(0, 8);
  } catch {
    return [];
  }
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

function buildPrompt(
  name: string,
  price: string,
  mode: "under" | "over",
  c: ValuationContext,
  news: Article[],
): string {
  const label = mode === "under" ? "저평가(PER이 낮은 편)" : "고평가(PER이 높은 편)";
  const peers = c.peers.length
    ? c.peers.map((p) => `- ${p.name}: PER ${p.per ?? "N/A"}, PBR ${p.pbr ?? "N/A"}`).join("\n")
    : "(동종업계 데이터 없음)";
  const newsBlock = news.length
    ? news
        .map(
          (a, i) =>
            `[뉴스${i + 1}] ${a.title}${a.summary ? `\n  요약: ${a.summary.slice(0, 200)}` : ""}`,
        )
        .join("\n")
    : "(관련 뉴스 없음)";

  return `당신은 '제공된 자료'만 정리하는 도구입니다. 아래 [데이터]와 [최근 뉴스]에 실제로 있는 내용 외에는 어떤 사실·전망도 쓰지 마세요. 당신이 알고 있는 배경지식으로 보완하지 말고, 주관적 판단('싸다/비싸다/유망하다/좋다')도 쓰지 마세요.

[종목] ${name} (현재가 ${price || "N/A"})
[밸류에이션 지표]
- PER: ${c.per ?? "N/A"}
- PBR: ${c.pbr ?? "N/A"}
- EPS: ${c.eps ?? "N/A"}
- 배당수익률: ${c.dividend ?? "N/A"}
- 시가총액: ${c.marketCap ?? "N/A"}
- 업종: ${c.industry ?? "N/A"}
- 52주 최고/최저: ${c.high52 ?? "N/A"} / ${c.low52 ?? "N/A"}
- 애널리스트 목표주가 평균: ${c.targetPrice ?? "N/A"}
- 애널리스트 투자의견 평균: ${c.recommMean ?? "N/A"} (1=강력매수, 3=중립, 5=강력매도)
[동종업계 비교]
${peers}

[최근 뉴스] ← 기술력·사업 설명은 오직 이 뉴스에만 근거할 것
${newsBlock}

이 종목은 PER 기준으로 '${label}' 그룹으로 분류됐습니다.
① 왜 그렇게 분류되는지 위 [데이터]의 숫자로 설명하고(points)
② 이 기업의 기술력·사업 내용을 위 [최근 뉴스]에 실제로 나온 것만으로 설명하세요(tech).

규칙(반드시 지킬 것):
- points: 위에 나온 숫자만 인용. 없는 값·추정·전망을 지어내지 말 것.
  "PER 8.16으로 동종업계 현대차 13.38보다 낮다" 처럼 숫자 비교로만 서술.
  동종업계 PER/PBR 비교, 목표주가 대비 현재가, 52주 위치 등 '상대적' 근거 위주.
- tech: **[최근 뉴스]에 문장으로 실제 존재하는 내용만** 쓸 것.
  * 각 항목 끝에 근거 뉴스 번호를 반드시 붙일 것. 예) "HBM4 양산 라인을 증설 중이다 [뉴스2]"
  * 뉴스에 없는 기술·제품·점유율·수주·전망을 절대 지어내지 말 것.
  * 당신의 사전 지식으로 "이 회사는 원래 ~를 잘한다" 같은 서술 금지.
  * 뉴스가 종목과 무관하거나 기술·사업 내용이 없으면 **tech를 빈 배열 []로 둘 것.**
    억지로 채우지 말 것. 빈 배열이 틀린 내용보다 낫다.
- 주관적 평가어("유망/매력적/뛰어난") 금지. 뉴스에 적힌 사실만 건조하게.
- N/A인 항목은 언급하지 말 것.

아래 JSON만 응답:
{"summary":"숫자를 포함한 1~2문장 요약","points":["숫자를 인용한 근거 문장","..."],"tech":["뉴스에 나온 기술/사업 사실 [뉴스N]","..."]}`;
}

function parse(raw: string, newsCount: number): Reason | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as {
      summary?: unknown;
      points?: unknown;
      tech?: unknown;
    };
    const summary = String(o.summary ?? "").trim().slice(0, 400);
    const points = Array.isArray(o.points)
      ? o.points.map((p) => String(p).trim()).filter(Boolean).slice(0, 6)
      : [];
    // 기술력 항목은 반드시 [뉴스N] 인용이 있어야 채택 (없으면 지어낸 것으로 보고 버림).
    // N도 실제 제공한 뉴스 개수 범위 안이어야 함.
    const tech = Array.isArray(o.tech)
      ? o.tech
          .map((t) => String(t).trim())
          .filter((t) => {
            if (!t) return false;
            const m = t.match(/\[뉴스\s*(\d+)\]/);
            if (!m) return false;
            const n = Number(m[1]);
            return n >= 1 && n <= newsCount;
          })
          .slice(0, 5)
      : [];
    if (!summary && !points.length) return null;
    return { summary, points, tech };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, reason: "no-key" }, { status: 500 });
  }
  let body: {
    name?: unknown;
    symbol?: unknown;
    domestic?: unknown;
    price?: unknown;
    mode?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 40);
  const symbol = String(body.symbol ?? "").trim();
  const domestic = !!body.domestic;
  const price = String(body.price ?? "").trim();
  const mode: "under" | "over" = body.mode === "over" ? "over" : "under";
  if (!name || !symbol) {
    return NextResponse.json({ ok: false, reason: "종목 정보가 없어요." }, { status: 400 });
  }

  // 저평가·고평가 분석은 프로 전용
  const user = await getUser(req);
  if (!user?.isPro) {
    return NextResponse.json(
      { ok: false, reason: "저평가·고평가 분석은 프로 전용이에요.", code: "PRO_ONLY" },
      { status: 403 },
    );
  }

  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  // 지표와 뉴스를 같이 가져옴 (뉴스는 기술력 설명의 유일한 근거)
  const [ctx, news] = await Promise.all([
    getValuationContext(symbol, domestic),
    techNews(name),
  ]);
  if (!ctx) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "지표 데이터를 불러오지 못했어요." },
      { status: 502 },
    );
  }

  const requestBody = JSON.stringify({
    contents: [
      { role: "user", parts: [{ text: buildPrompt(name, price, mode, ctx, news) }] },
    ],
    generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 1200 },
  });
  const out = await geminiRace(apiKey, requestBody);
  if (!out) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." }, { status: 503 });
  }
  const reason = parse(out, news.length);
  if (!reason) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI 응답을 해석하지 못했어요." }, { status: 502 });
  }
  // news도 함께 반환 → UI에서 근거 기사를 직접 눌러 확인할 수 있게 (검증 가능성)
  return NextResponse.json({
    ok: true,
    mode,
    reason,
    context: ctx,
    news,
    credits: charge.credits,
  });
}
