import { NextRequest, NextResponse } from "next/server";
import { aiFromGeminiBody } from "@/lib/textai";
import { chargeAI } from "@/lib/credits";
import { getUser } from "@/lib/auth";
import {
  getQuote,
  getStockDetail,
  getIndustry,
  getHoldingFacts,
  type HoldingFacts,
} from "@/lib/naver";

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
  facts: HoldingFacts | null;
  /** 코드가 판정한 특징 태그 — AI가 아니라 숫자에서 나온다 */
  tags: string[];
}

interface Review {
  summary: string;
  concentration: string[]; // 쏠림 진단
  balance: string[]; // 분산/보완 관점
  notes: { name: string; text: string }[]; // 종목별 관찰
}

// 관심종목 실제 지표 수집 (섹터·PER·수급·IR일정 전부 네이버 실데이터)
async function collect(stocks: Holding[]): Promise<Reviewed[]> {
  const CHUNK = 8;
  const out: Reviewed[] = [];
  for (let i = 0; i < stocks.length; i += CHUNK) {
    const part = await Promise.all(
      stocks.slice(i, i + CHUNK).map(async (s) => {
        try {
          const [q, d, ind, facts] = await Promise.all([
            getQuote({ symbol: s.symbol, domestic: s.domestic }),
            getStockDetail(s.symbol, s.domestic),
            getIndustry(s.symbol, s.domestic),
            getHoldingFacts(s.symbol, s.domestic).catch(() => null),
          ]);
          return {
            ...s,
            price: q?.price ?? null,
            changeRate: q?.changeRate ?? null,
            per: d?.per ?? null,
            industryCode: ind?.code ?? null,
            peers: ind?.peers ?? [],
            facts,
            tags: [],
          } satisfies Reviewed;
        } catch {
          return {
            ...s,
            price: null,
            changeRate: null,
            per: null,
            industryCode: null,
            peers: [],
            facts: null,
            tags: [],
          };
        }
      }),
    );
    out.push(...part);
  }
  return out;
}

/**
 * 숫자에서 바로 나오는 특징을 태그로 붙인다.
 * AI가 "저평가입니다" 라고 말하게 두면 환각이지만,
 * 코드가 PBR 0.87을 보고 붙인 태그는 사실이다.
 */
function tagAll(rows: Reviewed[]): void {
  const pers = rows.map((r) => r.facts?.per).filter((v): v is number => !!v && v > 0);
  const median = pers.length
    ? [...pers].sort((a, b) => a - b)[Math.floor(pers.length / 2)]
    : null;

  for (const r of rows) {
    const f = r.facts;
    if (!f) continue;
    const t: string[] = [];

    if (f.pbr != null && f.pbr < 1) t.push(`PBR ${f.pbr.toFixed(2)}배 (청산가치 미만)`);
    if (median && f.per != null && f.per > 0 && f.per < median * 0.7)
      t.push(`PER ${f.per.toFixed(1)}배 (목록 중앙값 ${median.toFixed(1)}배보다 낮음)`);
    if (median && f.per != null && f.per > median * 1.5)
      t.push(`PER ${f.per.toFixed(1)}배 (목록 중앙값 ${median.toFixed(1)}배보다 높음)`);
    // 추정PER이 현재 PER보다 크게 낮으면 '이익이 늘 것으로 추정'된 상태
    if (f.per != null && f.forwardPer != null && f.forwardPer > 0 && f.forwardPer < f.per * 0.7)
      t.push(`추정PER ${f.forwardPer.toFixed(1)}배 (현재 ${f.per.toFixed(1)}배보다 낮음)`);

    if (f.ir && f.ir.dday >= 0 && f.ir.dday <= 21)
      t.push(`D-${f.ir.dday} ${f.ir.title} (${f.ir.date})`);

    if (f.pos52 != null) {
      if (f.pos52 <= 20) t.push(`52주 구간 하단 ${f.pos52.toFixed(0)}%`);
      else if (f.pos52 >= 80) t.push(`52주 구간 상단 ${f.pos52.toFixed(0)}%`);
    }

    if (f.flow5d) {
      const { foreigner, organ } = f.flow5d;
      const unit = (n: number) =>
        `${n > 0 ? "+" : "-"}${Math.abs(Math.round(n / 10000))}만주`;
      if (organ < -100000 && foreigner < 0)
        t.push(`최근 5일 기관 ${unit(organ)}·외국인 ${unit(foreigner)} 순매도`);
      else if (organ > 100000 && foreigner > 0)
        t.push(`최근 5일 기관 ${unit(organ)}·외국인 ${unit(foreigner)} 순매수`);
      else if (Math.abs(organ) > 500000)
        t.push(`최근 5일 기관 ${unit(organ)}`);
    }

    if (f.targetGap != null && Math.abs(f.targetGap) >= 15)
      t.push(
        `증권사 목표주가 평균이 현재가보다 ${f.targetGap > 0 ? "높음" : "낮음"} (${f.targetGap > 0 ? "+" : ""}${f.targetGap.toFixed(0)}%)`,
      );

    r.tags = t.slice(0, 5);
  }
}

function buildPrompt(rows: Reviewed[]): string {
  const list = rows
    .map((r, i) => {
      const f = r.facts;
      const bits = [
        f?.per != null ? `PER ${f.per}배` : null,
        f?.pbr != null ? `PBR ${f.pbr}배` : null,
        f?.dividendYield ? `배당 ${f.dividendYield}%` : null,
        r.changeRate != null ? `오늘 ${r.changeRate}%` : null,
      ].filter(Boolean);
      const tagLine = r.tags.length ? `\n   특징: ${r.tags.join(" / ")}` : "";
      const rep = f?.reports?.length
        ? `\n   증권사 리포트 제목: ${f.reports.map((x) => `"${x.title}"(${x.broker})`).join(", ")}`
        : "";
      return `${i + 1}. ${r.name} (${r.ticker}, ${r.market}) · ${bits.join(" · ")}${tagLine}${rep}`;
    })
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
- **위에 나온 종목명·수치·특징만** 인용. 없는 정보를 추측하지 말 것.
  '특징'에 적힌 값은 이미 검증된 사실이므로 그대로 인용해도 된다. 숫자를 바꾸지 말 것.
- 특정 종목 매수/매도 권유 금지. "사라/팔아라/오를 것/목표가" 같은 표현 금지.
- concentration: 어떤 업종·시장에 몇 %가 몰려 있는지 등 '구성의 사실'을 지적.
- balance: 분산 관점에서 어떤 성격의 자산군이 목록에 없는지 '일반론'으로만 언급.
  (예: "경기방어 성격의 업종이 목록에 없습니다" — 특정 종목 추천은 금지)
- **notes: 특징이 있는 종목만 골라 2~5개.** 각 항목은 그 종목의 '특징'에 적힌 수치를
  근거로 한 관찰이어야 한다. 특징이 비어 있는 종목은 notes에 넣지 말 것.
  좋은 예) {"name":"현대차","text":"PBR 0.87배로 청산가치를 밑도는 수준이고, 7월 23일 2분기 실적 발표가 D-3로 임박했습니다. 최근 5일은 기관·외국인이 함께 순매수했습니다."}
  나쁜 예) {"name":"현대차","text":"현대차는 좋은 회사입니다"} ← 근거 없음
  나쁜 예) {"name":"현대차","text":"저평가라 지금이 매수 기회입니다"} ← 권유 금지
- notes의 문장은 '관찰된 사실 + 그 사실이 무엇을 뜻하는지'까지 2~3문장으로 구체적으로 쓸 것.
- 종목이 3개 미만이면 진단이 어렵다고 summary에 밝힐 것.

아래 JSON만 응답:
{"summary":"2~3문장 총평","concentration":["쏠림 사실",".."],"balance":["분산 관점 관찰",".."],"notes":[{"name":"종목명","text":"수치 근거가 있는 관찰 2~3문장"}]}`;
}

/**
 * 그래프용 비중. 관심종목은 수량 정보가 없으므로 '종목 수' 기준 동일가중이다.
 * (화면에도 그렇게 표기해야 실제 평가금액 비중으로 오해하지 않는다)
 */
function buildCharts(rows: Reviewed[]) {
  const n = rows.length || 1;
  const pct = (c: number) => Math.round((c / n) * 1000) / 10;

  const byMarket = [
    { label: "국내", count: rows.filter((r) => r.domestic).length },
    { label: "해외", count: rows.filter((r) => !r.domestic).length },
  ]
    .filter((g) => g.count > 0)
    .map((g) => ({ ...g, pct: pct(g.count), names: [] as string[] }));

  // 같은 industryCode = 같은 업종. 네이버가 업종명을 안 주므로 종목명으로 라벨링한다.
  const groups = new Map<string, string[]>();
  for (const r of rows) {
    const k = r.industryCode ?? `기타-${r.domestic ? "국내" : "해외"}`;
    groups.set(k, [...(groups.get(k) ?? []), r.name]);
  }
  const bySector = [...groups.values()]
    .sort((a, b) => b.length - a.length)
    .map((names) => ({
      label: names.length > 1 ? `${names[0]} 외 ${names.length - 1}` : names[0],
      count: names.length,
      pct: pct(names.length),
      names,
    }));

  return { basis: "종목 수 기준 (동일가중)", byMarket, bySector };
}

function parse(raw: string, known: Set<string>): Review | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as Record<string, unknown>;
    const arr = (v: unknown) =>
      Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean).slice(0, 5) : [];
    // 목록에 없는 종목 이름이 나오면 지어낸 것 → 폐기
    const notes = Array.isArray(o.notes)
      ? (o.notes as unknown[])
          .map((n) => n as Record<string, unknown>)
          .map((n) => ({
            name: String(n?.name ?? "").trim(),
            text: String(n?.text ?? "").trim(),
          }))
          .filter((n) => n.name && n.text && known.has(n.name))
          .slice(0, 5)
      : [];
    const review: Review = {
      summary: String(o.summary ?? "").trim().slice(0, 600),
      concentration: arr(o.concentration),
      balance: arr(o.balance),
      notes,
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

  // 무료 플랜도 크레딧으로 이용(프로 전용 아님). 프로는 chargeAI에서 무제한 처리.
  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  const rows = await collect(stocks);
  tagAll(rows);
  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: buildPrompt(rows) }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 1600,
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
  const review = parse(out, new Set(rows.map((r) => r.name)));
  if (!review) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI 응답을 해석하지 못했어요." }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    review,
    holdings: rows,
    charts: buildCharts(rows), // 그래프용 — 코드가 센 값
    credits: charge.credits,
  });
}
