import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { geminiRace } from "@/lib/gemini";
import { aiFromGeminiBody } from "@/lib/textai";
import { chargeAI } from "@/lib/credits";
import {
  decode,
  meta,
  extractParagraphs,
  isBoilerplate,
  trimTrailingHeadlines,
} from "@/lib/readable";
import { isGoogleNewsUrl, resolveGoogleNews } from "@/lib/gnews";
import {
  resolveSymbol,
  getQuote,
  getValuationContext,
  type ValuationContext,
} from "@/lib/naver";
import { fetchSource } from "@/lib/rss";
import { translateMany } from "@/lib/translate";
import { SOURCE_MAP } from "@/lib/sources";
import type { Article, Source } from "@/lib/types";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 60; // 영상 이해는 오래 걸린다

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/* ─────────────────────────── SSRF 방어 ───────────────────────────
   사용자가 아무 URL이나 붙여넣을 수 있으므로 내부망을 못 찌르게 막는다.
   호스트명만 보면 우회되므로(예: 내부 IP로 향하는 도메인) 실제 IP를 조회해 검사한다. */
function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    // IPv6: 루프백(::1), 링크로컬(fe80::), 유니크로컬(fc00::/7)
    const v = ip.toLowerCase();
    return (
      v === "::1" ||
      v === "::" ||
      v.startsWith("fe80:") ||
      v.startsWith("fc") ||
      v.startsWith("fd") ||
      v.startsWith("::ffff:") // IPv4 매핑 — 아래 IPv4 검사로 다시 걸러야 함
    );
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // 링크로컬 + 클라우드 메타데이터(169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224 // 멀티캐스트/예약
  );
}

async function safeUrl(raw: string): Promise<URL | null> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  try {
    const { address } = await lookup(u.hostname);
    if (isPrivateIp(address)) return null;
  } catch {
    return null; // 조회 안 되는 호스트는 거부
  }
  return u;
}

/* ─────────────────────────── 유튜브 ─────────────────────────── */
function youtubeId(u: URL): string | null {
  const h = u.hostname.replace(/^www\./, "");
  if (h === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
  if (!h.endsWith("youtube.com")) return null;
  const v = u.searchParams.get("v");
  if (v) return v;
  const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)/);
  return m ? m[1] : null;
}

// ⚠️ Gemini가 영상을 못 봤을 때 내놓는 말들. 이걸 요약인 척 보여주면 안 된다.
//    (라이브 스트림·비공개·너무 긴 영상에서 실제로 발생함 — 검증됨)
const CANNOT_WATCH =
  /(영상을?\s*(직접\s*)?(시청|볼|재생|확인)할\s*수\s*없|제공되지\s*않았|영상이\s*없|I (cannot|can't|am unable to) (watch|access|view)|죄송하지만|알려주시면)/;

/** 한 번에 분석하는 길이. 이보다 길면 Vercel 60초 제한을 넘긴다(실측: 20분=69초). */
const SEG_SEC = 600;

/** 영상 길이(초). 못 알아내면 null — 그때는 구간 나누기를 제공하지 않는다. */
async function videoDuration(videoUrl: string): Promise<number | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 8000);
  try {
    const r = await fetch(videoUrl, {
      headers: { "User-Agent": UA, "Accept-Language": "ko-KR" },
      signal: ac.signal,
    });
    if (!r.ok) return null;
    const h = await r.text();
    const m = h.match(/"lengthSeconds":"(\d+)"/);
    const n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}분`;
}

async function summarizeYoutube(
  apiKey: string,
  url: string,
  segment: number,
): Promise<
  | { ok: true; points: string[]; stocks: string[] }
  | { ok: false; reason: string }
> {
  const prompt = `이 영상은 증권·경제 방송입니다. 영상 내용을 한국어로 요약하세요.

반드시 지킬 것:
- **받아쓰기 금지.** 들은 말을 순서대로 옮기지 말고, 정보 가치가 있는 것만 골라낼 것.
- 다음은 **무조건 제외**: 인사말, 출연자끼리의 잡담, 방송 진행 멘트(출연 요일·다음 방송 안내 등),
  농담, 소감("바랐다/아쉽다" 같은 감상), 자기소개, 구독 요청.
- 남길 것은 **종목명·지수·수치·정책·일정·전망 근거** 등 투자 판단에 실제로 쓰이는 정보뿐.
- 좋은 예) "코스피 변동성지수(VKOSPI)가 98까지 올랐다가 87선으로 내려왔다고 설명했습니다."
  나쁜 예) "출연자는 오늘 시장이 무겁다고 말했습니다." ← 정보 없음, 쓰지 말 것
- 각 항목은 완결된 한 문장. 반드시 한국어로 쓸 것(영어 금지).
- **영상에 실제 나온 내용만.** 배경지식으로 보태거나 추측하지 말 것.
- 출연자의 주관적 판단은 "출연자는 ~라고 봤습니다"처럼 발언임을 밝힐 것.
- 정보 가치가 있는 내용이 적으면 항목 수를 줄일 것. 억지로 채우지 말 것.
- 영상을 볼 수 없으면 요약을 지어내지 말고 points를 빈 배열 []로 둘 것.

또한 영상에서 언급된 **상장 기업**을 stocks에 넣으세요(최대 4개).
- 제품·서비스·모델만 언급됐으면 **그것을 만든 상장 기업명**을 넣을 것.
  예) "갤럭시"→"삼성전자", "GPT"→(오픈AI는 비상장이니 제외), "미모 V2.5"→"샤오미".
- 국내·해외 상장사 모두 가능(예: 삼성전자, 엔비디아, 샤오미, 텐센트, 애플).
- **비상장 회사(딥시크·앤트로픽·오픈AI·문샷 등)와 지수·업종은 제외.**
- 실제로 언급된 것만. 없으면 빈 배열 [].

JSON만 응답: {"points":["핵심 1","..."],"stocks":["상장기업명1","상장기업명2"]}`;

  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          {
            fileData: { fileUri: url },
            // ⚠️ 이 세 값이 성능의 핵심(측정: 186초 → 32초).
            //    Vercel 함수 제한(60초) 안에 못 들어오면 기능 자체가 못 쓰게 된다.
            //    - 10분씩 끊어 보기: 통째로 넣으면 시간 초과(20분=69초)
            //    - fps 0.1: 말하는 영상이라 프레임은 거의 필요 없다(음성이 핵심)
            videoMetadata: {
              startOffset: `${segment * SEG_SEC}s`,
              endOffset: `${(segment + 1) * SEG_SEC}s`,
              fps: 0.1,
            },
          },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      // thinking을 크게 주면 시간 초과, 0이면 요약 대신 받아쓰기를 한다. 512가 균형점.
      thinkingConfig: { thinkingBudget: 512 },
      maxOutputTokens: 3000,
    },
  });

  // ⚠️ 영상은 모델을 가린다(실측):
  //    gemini-2.5-flash      → 이 계정 무료 한도라 429/503이 잦다(예비용으로만 둔다)
  //    gemini-flash-latest   → 응답은 오는데 points가 비어 옴(사실상 못 봄)
  //    gemini-2.5-flash-lite → 유일하게 믿을 만하다. 다만 영상마다 12~31초로 편차가 크다.
  // 그래서 타임아웃은 Vercel 함수 한도(60초) 직전까지 최대한 준다.
  // 45초로 뒀더니 31초짜리 영상이 순간 지연으로 실패하는 사례가 있었다.
  const errors: string[] = [];
  const out = await geminiRace(
    apiKey,
    body,
    ["gemini-2.5-flash-lite", "gemini-2.5-flash"],
    52000,
    errors,
  );
  if (!out) {
    // ⚠️ 실패 원인을 구분해야 한다. 한도 초과인데 "라이브 방송이라서"라고 하면 거짓 안내다.
    if (errors.some((e) => e.endsWith(":429")))
      return {
        ok: false,
        reason: "오늘 AI 사용량이 많아 잠시 이용할 수 없어요. 내일 다시 시도해 주세요.",
      };
    if (errors.some((e) => e.endsWith(":503")))
      return { ok: false, reason: "AI가 혼잡해요. 잠시 후 다시 시도해 주세요." };
    // 에러 없이 시간만 초과 = 영상이 너무 길거나 라이브인 경우
    return {
      ok: false,
      reason:
        "이 영상은 요약하지 못했어요. 라이브 방송이거나 아주 긴 영상은 분석이 어려워요.",
    };
  }
  if (CANNOT_WATCH.test(out)) {
    return {
      ok: false,
      reason:
        "이 영상은 AI가 볼 수 없어요. 라이브 방송이거나 길이가 너무 긴 영상일 수 있어요.",
    };
  }
  try {
    const clean = out.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const o = JSON.parse(clean) as { points?: unknown; stocks?: unknown };
    const points = Array.isArray(o.points)
      ? o.points.map((p) => String(p).trim()).filter(Boolean).slice(0, 7)
      : [];
    const stocks = Array.isArray(o.stocks)
      ? [...new Set(o.stocks.map((s) => String(s).trim()).filter(Boolean))].slice(0, 4)
      : [];
    if (!points.length)
      return {
        ok: false,
        reason:
          "이 영상은 AI가 볼 수 없어요. 라이브 방송이거나 길이가 너무 긴 영상일 수 있어요.",
      };
    return { ok: true, points, stocks };
  } catch {
    return { ok: false, reason: "AI 응답을 해석하지 못했어요." };
  }
}

/* ───────────────── 영상에서 언급된 종목 분석 ─────────────────
   ⚠️ 밸류에이션 수치는 전부 코드가 네이버에서 가져온 실데이터.
      AI는 그 수치와 '실제 뉴스'만으로 설명하고, 저평가/고평가 판정 근거는
      숫자(목표주가 괴리·동종업계 PER 비교)로 코드가 먼저 계산한다. */

export interface StockBrief {
  name: string;
  symbol: string;
  domestic: boolean;
  price: string | null;
  changeRate: number | null;
  per: string | null;
  pbr: string | null;
  targetPrice: string | null;
  targetGap: number | null; // 목표주가 대비 괴리(%). 양수=목표가가 위
  industry: string | null;
  peers: { name: string; per: string | null }[];
  valuation: "under" | "over" | "fair" | "unknown";
  about: string; // 회사가 뭐하는지 (뉴스 근거)
  points: string[]; // 밸류에이션·전망 설명 (각 [뉴스N] 인용)
  news: { title: string; link: string }[];
}

// 종목별 최근 뉴스 (급등락 사유와 같은 방식: 구글뉴스 3일)
async function stockNews(name: string): Promise<Article[]> {
  const base = SOURCE_MAP["gnews_kr"];
  if (!base) return [];
  const src: Source = {
    ...base,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${name} (실적 OR 목표주가 OR 전망 OR 밸류에이션 OR 사업) when:14d`,
    )}&hl=ko&gl=KR&ceid=KR:ko`,
  };
  let arts: Article[] = [];
  try {
    arts = (await fetchSource(src)).slice(0, 6);
  } catch {
    return [];
  }
  if (arts.length) {
    try {
      const tr = await translateMany(arts.flatMap((a) => [a.title, a.summary || ""]));
      let i = 0;
      for (const a of arts) {
        a.title = tr[i++] || a.title;
        a.summary = tr[i++] || a.summary;
      }
    } catch {
      /* 원문 사용 */
    }
  }
  return arts;
}

/** 목표주가 괴리와 동종업계 PER로 저평가/고평가를 코드가 판정 */
function judgeValuation(ctx: ValuationContext, price: number | null): {
  valuation: StockBrief["valuation"];
  targetGap: number | null;
} {
  const num = (s: string | null) => {
    if (!s) return null;
    const n = Number(String(s).replace(/[,%원배\s]/g, ""));
    return Number.isFinite(n) ? n : null;
  };
  const target = num(ctx.targetPrice);
  const gap = target != null && price != null && price > 0 ? ((target - price) / price) * 100 : null;

  const per = num(ctx.per);
  const peerPers = ctx.peers.map((p) => num(p.per)).filter((x): x is number => x != null && x > 0);
  const peerMed = peerPers.length
    ? [...peerPers].sort((a, b) => a - b)[Math.floor(peerPers.length / 2)]
    : null;

  // 신호를 모아 다수결: 목표가 괴리 + 동종업계 PER 대비
  let under = 0;
  let over = 0;
  if (gap != null) {
    if (gap >= 15) under++;
    else if (gap <= -10) over++;
  }
  if (per != null && per > 0 && peerMed != null) {
    if (per < peerMed * 0.8) under++;
    else if (per > peerMed * 1.25) over++;
  }
  // ⚠️ 비교할 근거(목표주가 괴리 or 동종업계 PER)가 하나도 없으면 판단 보류.
  //    해외주는 목표주가·동종업계가 없어 PER만 있는데, 그것만으로 저/고평가를 말하면 안 된다.
  const hasBasis = gap != null || peerMed != null;
  const valuation: StockBrief["valuation"] =
    under > over ? "under" : over > under ? "over" : hasBasis ? "fair" : "unknown";
  return { valuation, targetGap: gap };
}

// brief + 원문 기사(프롬프트용)를 함께 반환해 뉴스 중복 fetch를 피한다.
async function briefOne(name: string): Promise<{ brief: StockBrief; articles: Article[] } | null> {
  const r = await resolveSymbol("", name).catch(() => null);
  if (!r) return null;
  const [q, ctx, news] = await Promise.all([
    getQuote({ symbol: r.symbol, domestic: r.domestic }).catch(() => null),
    getValuationContext(r.symbol, r.domestic).catch(() => null),
    stockNews(name),
  ]);
  if (!ctx) return null;
  const price = q?.price ? Number(q.price.replace(/[,]/g, "")) : null;
  const { valuation, targetGap } = judgeValuation(ctx, price);
  return {
    articles: news,
    brief: {
      name,
      symbol: r.symbol,
      domestic: r.domestic,
      price: q?.price ?? null,
      changeRate: q?.changeRate ?? null,
      per: ctx.per,
      pbr: ctx.pbr,
      targetPrice: ctx.targetPrice,
      targetGap,
      industry: ctx.industry,
      peers: ctx.peers.map((p) => ({ name: p.name, per: p.per })),
      valuation,
      about: "",
      points: [],
      news: news.map((a) => ({ title: a.title, link: a.link })),
    },
  };
}

// 코드가 모은 수치·뉴스로 AI가 '회사 설명 + 밸류에이션 설명'을 채운다(인용 필수).
async function explainBriefs(
  apiKey: string,
  briefs: StockBrief[],
  newsMap: Map<string, Article[]>,
): Promise<void> {
  const blocks = briefs
    .map((b, bi) => {
      const news = (newsMap.get(b.name) ?? [])
        .map((a, i) => `  [뉴스${bi + 1}-${i + 1}] ${a.title}${a.summary ? ` / ${a.summary.slice(0, 120)}` : ""}`)
        .join("\n");
      const vlabel =
        b.valuation === "under" ? "저평가 신호" : b.valuation === "over" ? "고평가 신호" : "중립";
      return `${bi + 1}. ${b.name} (${b.symbol})
  현재가 ${b.price ?? "?"} · PER ${b.per ?? "?"} · PBR ${b.pbr ?? "?"} · 목표주가 ${b.targetPrice ?? "?"}${b.targetGap != null ? ` (괴리 ${b.targetGap > 0 ? "+" : ""}${b.targetGap.toFixed(0)}%)` : ""}
  동종업계: ${b.peers.map((p) => `${p.name}(PER ${p.per ?? "?"})`).join(", ") || "정보없음"}
  코드 판정: ${vlabel}
  관련 뉴스:
${news || "  (없음)"}`;
    })
    .join("\n\n");

  const prompt = `아래는 어떤 증권 방송 영상에서 언급된 종목들의 '실제 지표'와 '실제 뉴스'입니다.
각 종목에 대해 두 가지를 채우세요.

반드시 지킬 것:
- **about(회사 설명)**: 그 회사가 무엇을 하는 회사인지 1~2문장. 뉴스에 근거가 있으면 인용, 없으면 널리 알려진 사실만 간단히.
- **points(밸류에이션 설명)**: 위 PER·PBR·목표주가 괴리·동종업계 비교와 '관련 뉴스'만 근거로,
  이 종목이 저평가인지 고평가인지 객관적으로 설명. 각 항목 끝에 근거 뉴스 번호 [뉴스N-M]을 붙일 것.
  숫자를 지어내지 말 것(위에 준 수치만 사용). 뉴스에 없는 사실을 추측하지 말 것.
  "코드 판정"과 다르게 볼 근거가 뉴스에 있으면 그렇게 써도 됨(단 근거 인용).
- 투자 권유("사라/팔아라") 금지. 판단은 이용자 몫임을 전제로 사실만.
- 뉴스가 없어 설명이 어려우면 points를 빈 배열로.

종목들:
${blocks}

JSON만 응답:
{"briefs":[{"name":"종목명","about":"회사 설명","points":["밸류에이션 설명 [뉴스N-M]","..."]}]}`;

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 2000,
    },
  });
  const out = await aiFromGeminiBody(body);
  if (!out) return;
  try {
    const clean = out.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const o = JSON.parse(clean) as { briefs?: { name?: string; about?: string; points?: unknown }[] };
    for (const item of o.briefs ?? []) {
      const b = briefs.find((x) => x.name === item.name);
      if (!b) continue;
      b.about = String(item.about ?? "").trim().slice(0, 300);
      // [뉴스N-M] 인용이 있는 항목만 채택(지어낸 문장 제거)
      b.points = Array.isArray(item.points)
        ? item.points
            .map((p) => String(p).trim())
            .filter((p) => /\[뉴스\s*\d+-\d+\]/.test(p))
            .slice(0, 4)
        : [];
    }
  } catch {
    /* 파싱 실패 시 about/points 비운 채 반환 */
  }
}

/* ─────────────────────────── 일반 기사 ─────────────────────────── */
async function fetchArticle(
  url: string,
): Promise<{ title: string; text: string; image: string | null } | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12000);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko,en;q=0.8" },
      signal: ac.signal,
    });
    if (!r.ok) return null;
    const html = await r.text();
    const paras = trimTrailingHeadlines(
      extractParagraphs(html).filter((p) => !isBoilerplate(p)),
    );
    return {
      title: decode(meta(html, "og:title") || ""),
      text: paras.join("\n").slice(0, 8000),
      image: meta(html, "og:image") || null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function summarizeArticle(
  apiKey: string,
  title: string,
  text: string,
): Promise<{ ok: true; points: string[] } | { ok: false; reason: string }> {
  const prompt = `아래 기사 본문을 한국어 핵심 3~6불릿으로 요약하세요.

규칙(반드시 지킬 것):
- **본문에 실제로 있는 내용만** 쓸 것. 배경지식으로 보태거나 추측하지 말 것.
- 기업명·수치·날짜를 바꾸지 말 것. 본문에 있는 그대로.
- 투자 권유("사라/팔아라/오를 것") 금지.

[제목] ${title}
[본문]
${text}

아래 JSON만 응답:
{"points":["핵심 1","핵심 2","..."]}`;

  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 1000,
    },
  });
  const out = await aiFromGeminiBody(body);
  if (!out) return { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." };
  try {
    const clean = out.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const o = JSON.parse(clean) as { points?: unknown };
    const points = Array.isArray(o.points)
      ? o.points.map((p) => String(p).trim()).filter(Boolean).slice(0, 7)
      : [];
    if (!points.length) return { ok: false, reason: "요약할 내용을 찾지 못했어요." };
    return { ok: true, points };
  } catch {
    return { ok: false, reason: "AI 응답을 해석하지 못했어요." };
  }
}

/* ─────────────────────────── 라우트 ─────────────────────────── */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "no-key" }, { status: 500 });

  let body: { url?: unknown; segment?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const raw = String(body.url ?? "").trim().slice(0, 2000);
  if (!raw) {
    return NextResponse.json({ ok: false, reason: "링크를 입력해 주세요." }, { status: 400 });
  }
  const u = await safeUrl(raw.startsWith("http") ? raw : `https://${raw}`);
  if (!u) {
    return NextResponse.json(
      { ok: false, reason: "올바른 링크가 아니에요. http/https 주소를 넣어 주세요." },
      { status: 400 },
    );
  }

  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  const vid = youtubeId(u);
  if (vid) {
    const watch = `https://www.youtube.com/watch?v=${vid}`;
    const segment = Math.max(0, Math.min(29, Number(body.segment) || 0));
    const [res, duration] = await Promise.all([
      summarizeYoutube(apiKey, watch, segment),
      videoDuration(watch),
    ]);
    if (!res.ok) {
      await charge.refund?.(); // 못 본 영상은 크레딧을 돌려준다
      return NextResponse.json({ ok: false, reason: res.reason }, { status: 422 });
    }
    const from = segment * SEG_SEC;
    const to = duration ? Math.min((segment + 1) * SEG_SEC, duration) : (segment + 1) * SEG_SEC;

    // 영상에서 언급된 종목 분석 (첫 구간에서만 — 이어보기마다 반복 분석은 낭비).
    // 실데이터(밸류에이션·뉴스) 수집은 코드가, 설명은 AI가 인용 기반으로.
    let briefs: StockBrief[] = [];
    if (segment === 0 && res.stocks.length) {
      const built = (
        await Promise.all(res.stocks.slice(0, 4).map((s) => briefOne(s).catch(() => null)))
      ).filter((x): x is { brief: StockBrief; articles: Article[] } => x != null);
      briefs = built.map((x) => x.brief);
      if (briefs.length) {
        const newsMap = new Map<string, Article[]>();
        for (const x of built) newsMap.set(x.brief.name, x.articles);
        await explainBriefs(apiKey, briefs, newsMap).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      kind: "youtube",
      url: watch,
      thumbnail: `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
      points: res.points,
      briefs, // 언급 종목 분석 (없으면 빈 배열)
      // 어느 구간을 본 것인지 화면에 반드시 알린다(전체를 본 것처럼 오해하면 안 됨)
      scope: `${mmss(from)}~${mmss(to)} 구간`,
      segment,
      duration,
      // 다음 구간이 남아 있으면 '이어서 보기'를 제공할 수 있다
      hasMore: duration != null && (segment + 1) * SEG_SEC < duration,
      credits: charge.credits,
    });
  }

  // 구글뉴스 링크는 실제 기사 주소로 먼저 해석
  let target = u.toString();
  if (isGoogleNewsUrl(target)) {
    const real = await resolveGoogleNews(target).catch(() => null);
    if (real) {
      const safe = await safeUrl(real);
      if (safe) target = safe.toString();
    }
  }

  const art = await fetchArticle(target);
  if (!art || art.text.trim().length < 200) {
    await charge.refund?.();
    return NextResponse.json(
      {
        ok: false,
        reason:
          "이 링크에서 본문을 읽지 못했어요. 로그인이 필요하거나 접근이 막힌 페이지일 수 있어요.",
      },
      { status: 422 },
    );
  }

  const res = await summarizeArticle(apiKey, art.title, art.text);
  if (!res.ok) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: res.reason }, { status: 502 });
  }
  return NextResponse.json({
    ok: true,
    kind: "article",
    url: target,
    title: art.title,
    image: art.image,
    points: res.points,
    credits: charge.credits,
  });
}
