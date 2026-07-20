import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";
import { chargeAI } from "@/lib/credits";
import { getUser } from "@/lib/auth";
import { getQuote, getStockDetail, getIndustry } from "@/lib/naver";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

interface Holding {
  name: string;
  ticker: string;
  symbol: string;
  market: string;
  domestic: boolean;
}

interface Reviewed extends Holding {
  price: string | null;
  changeRate: number | null;
  per: number | null;
  industryCode: string | null; // 같은 코드 = 같은 업종
  peers: string[]; // 동종업계 (업종 라벨용)
}

interface Review {
  summary: string;
  concentration: string[]; // 쏠림 진단
  balance: string[]; // 분산/보완 관점
}

// 관심종목 실제 지표 수집 (섹터·PER은 네이버 실데이터)
async function collect(stocks: Holding[]): Promise<Reviewed[]> {
  const CHUNK = 10;
  const out: Reviewed[] = [];
  for (let i = 0; i < stocks.length; i += CHUNK) {
    const part = await Promise.all(
      stocks.slice(i, i + CHUNK).map(async (s) => {
        try {
          const [q, d, ind] = await Promise.all([
            getQuote({ symbol: s.symbol, domestic: s.domestic }),
            getStockDetail(s.symbol, s.domestic),
            getIndustry(s.symbol, s.domestic),
          ]);
          return {
            ...s,
            price: q?.price ?? null,
            changeRate: q?.changeRate ?? null,
            per: d?.per ?? null,
            industryCode: ind?.code ?? null,
            peers: ind?.peers ?? [],
          } satisfies Reviewed;
        } catch {
          return {
            ...s,
            price: null,
            changeRate: null,
            per: null,
            industryCode: null,
            peers: [],
          };
        }
      }),
    );
    out.push(...part);
  }
  return out;
}

function buildPrompt(rows: Reviewed[]): string {
  const list = rows
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} (${r.ticker}, ${r.market}) · PER ${r.per ?? "정보없음"} · 등락 ${r.changeRate ?? "?"}%`,
    )
    .join("\n");

  // 업종 집계 — AI가 세는 게 아니라 코드가 센 값을 준다(수치 환각 방지).
  // 네이버는 업종명을 안 줘서 industryCode로 묶고, 그 그룹에 속한 종목명으로 라벨링.
  const groups = new Map<string, string[]>();
  rows.forEach((r) => {
    const k = r.industryCode ?? `기타-${r.domestic ? "국내" : "해외"}`;
    groups.set(k, [...(groups.get(k) ?? []), r.name]);
  });
  const sectorLine = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(
      ([, names]) =>
        `[${names.join("·")}] ${names.length}종목(${Math.round((names.length / rows.length) * 100)}%)`,
    )
    .join(", ");
  const krCount = rows.filter((r) => r.domestic).length;

  return `당신은 '제공된 목록'만 근거로 관심종목 구성을 진단하는 도구입니다. 아래 데이터에 없는 종목·수치·전망을 지어내지 마세요.

[관심종목 ${rows.length}개]
${list}

[집계 — 이 수치를 그대로 인용할 것]
- 같은 업종끼리 묶은 그룹: ${sectorLine}
  (대괄호 안 종목들이 서로 같은 업종입니다. 업종명은 주어지지 않았으니
   "삼성전자·SK하이닉스가 같은 업종으로 2종목(40%)" 처럼 종목명으로 표현하세요.)
- 국내 ${krCount}종목 / 해외 ${rows.length - krCount}종목

위 구성을 객관적으로 진단하세요.

규칙(반드시 지킬 것):
- **위에 나온 종목명·업종·수치만** 인용. 없는 정보를 추측하지 말 것.
- 특정 종목 매수/매도 권유 금지. "사라/팔아라/오를 것" 같은 표현 금지.
- concentration: 어떤 업종·시장에 몇 %가 몰려 있는지 등 '구성의 사실'을 지적.
- balance: 분산 관점에서 어떤 성격의 자산군이 목록에 없는지 '일반론'으로만 언급.
  (예: "경기방어 성격의 업종이 목록에 없습니다" — 특정 종목 추천은 금지)
- 종목이 3개 미만이면 진단이 어렵다고 summary에 밝힐 것.

아래 JSON만 응답:
{"summary":"1~2문장 총평","concentration":["쏠림 사실",".."],"balance":["분산 관점 관찰",".."]}`;
}

function parse(raw: string): Review | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as Record<string, unknown>;
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 5) : [];
    const review: Review = {
      summary: String(o.summary ?? "").trim().slice(0, 400),
      concentration: arr(o.concentration),
      balance: arr(o.balance),
    };
    if (!review.summary && !review.concentration.length) return null;
    return review;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "no-key" }, { status: 500 });

  let body: { stocks?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const raw = Array.isArray(body.stocks) ? body.stocks : [];
  const stocks: Holding[] = raw
    .map((s) => s as Record<string, unknown>)
    .filter((s) => s && s.symbol)
    .slice(0, 30)
    .map((s) => ({
      name: String(s.name ?? ""),
      ticker: String(s.ticker ?? ""),
      symbol: String(s.symbol ?? ""),
      market: String(s.market ?? ""),
      domestic: !!s.domestic,
    }));

  if (stocks.length < 2) {
    return NextResponse.json(
      { ok: false, reason: "관심 종목을 2개 이상 추가하면 진단할 수 있어요." },
      { status: 400 },
    );
  }

  // 포트폴리오 진단은 프로 전용
  const user = await getUser(req);
  if (!user?.isPro) {
    return NextResponse.json(
      { ok: false, reason: "포트폴리오 진단은 프로 전용이에요.", code: "PRO_ONLY" },
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

  const rows = await collect(stocks);
  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(rows) }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 900,
    },
  });
  const out = await geminiRace(apiKey, requestBody);
  if (!out) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
  const review = parse(out);
  if (!review) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI 응답을 해석하지 못했어요." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, review, holdings: rows, credits: charge.credits });
}
