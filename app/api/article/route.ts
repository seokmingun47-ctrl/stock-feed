import { NextRequest, NextResponse } from "next/server";
import { translateMany } from "@/lib/translate";
import { isGoogleNewsUrl, resolveGoogleNews } from "@/lib/gnews";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// SSRF 방지: 알려진 뉴스 도메인만 허용
const ALLOWED = [
  // 해외
  "cnbc.com",
  "bbc.co.uk",
  "bbc.com",
  "yahoo.com",
  "nasdaq.com",
  "businessinsider.com",
  "fool.com",
  "seekingalpha.com",
  "fortune.com",
  "npr.org",
  "theguardian.com",
  "coindesk.com",
  "theverge.com",
  "techcrunch.com",
  // 우주 · AI반도체 전문
  "arstechnica.com",
  "spacenews.com",
  "semianalysis.com",
  // 국내
  "hankyung.com",
  "yna.co.kr",
  "edaily.co.kr",
  "chosun.com",
  "fnnews.com",
  "mk.co.kr",
  "asiae.co.kr",
  "einfomax.co.kr",
  "hani.co.kr",
  "mt.co.kr",
  "thelec.kr",
  "etnews.com",
];

function allowed(host: string): boolean {
  return ALLOWED.some((d) => host === d || host.endsWith("." + d));
}

function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function meta(html: string, prop: string): string {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const m = html.match(re);
  return m ? decode(m[1]) : "";
}

const JUNK =
  /cookie|subscribe|newsletter|sign up|sign in|©|all rights reserved|terms of|privacy policy|무단[ ]?전재|재배포 금지|저작권자|구독하기|기자\s*$|@[\w.-]+\.(?:com|co\.kr)/i;

function clean(t: string): string {
  return decode(t.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function dedupe(ps: string[]): string[] {
  const out: string[] = [];
  for (const p of ps)
    if (p.length > 30 && !JUNK.test(p) && out[out.length - 1] !== p) out.push(p);
  return out;
}

function totalLen(ps: string[]): number {
  return ps.reduce((a, p) => a + p.length, 0);
}

// 문자열 리터럴을 고려해 start 위치의 { } JSON 객체를 정확히 잘라냄
function sliceJsonObject(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

// Arc XP(조선비즈 등): window.Fusion.globalContent.content_elements에서 본문 추출
function fusionParas(html: string): string[] {
  const key = "Fusion.globalContent";
  const i = html.indexOf(key);
  if (i < 0) return [];
  const eq = html.indexOf("=", i);
  const brace = eq >= 0 ? html.indexOf("{", eq) : -1;
  if (brace < 0) return [];
  const json = sliceJsonObject(html, brace);
  if (!json) return [];
  try {
    const gc = JSON.parse(json) as { content_elements?: Array<Record<string, unknown>> };
    const els = gc.content_elements || [];
    const out: string[] = [];
    for (const e of els) {
      if ((e.type === "text" || e.type === "header") && typeof e.content === "string") {
        out.push(clean(e.content));
      }
    }
    return dedupe(out);
  } catch {
    return [];
  }
}

// 블록/<br> 단위로 텍스트를 문단으로 쪼갬 (div+<br> 본문용)
function blockParas(htmlChunk: string): string[] {
  const lines = htmlChunk
    .replace(/<(?:script|style)[\s\S]*?<\/(?:script|style)>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|figcaption|blockquote)>/gi, "\n")
    .split(/\n+/)
    .map(clean);
  return dedupe(lines.filter((t) => t.length > 30));
}

// 사이트 슬로건·구독 유도·페이월·AI안내 등은 본문이 아님 (번역 전 원문 기준으로 거름)
const BOILERPLATE = [
  // ── 해외 ──
  /^covering the business and politics of space$/i,
  /enter the code sent to your email/i,
  /we('|’)?ll send a verification code/i,
  /register (now )?to (get|read)/i,
  /free article[s]? (left|this month|remaining)/i,
  /to get \d+ more free article/i,
  /unlimited access to/i,
  /cancel anytime/i,
  /sales tax may apply/i,
  /non-?refundable/i,
  /terms of service apply/i,
  /subscribe to (continue|read|keep reading)/i,
  /already a (subscriber|member)\?/i,
  /sign up for (our )?newsletter/i,
  /this article is (for|available to) subscribers/i,
  /follow us on (twitter|x|facebook)/i,
  /all rights reserved/i,
  // ── 국내 (한경·매경 등 광고/AI/구독 유도) ──
  /검색에서 .{0,20}기사를 더 자주 볼 수 있습니다/,
  /머릿속에 맴돌던 질문|앨리스가 대답/,
  /투자 권유·자문·추천에 해당하지 않습니다/,
  /월 \d+회 제공되며 매월 \d+일 초기화/,
  /프리미엄\d*와 함께|프리미엄\d*까지 함께 이용/,
  /지금 바로 경험하고|경품 및 혜택을 확인/,
  /함께해 주셔서 진심으로 감사합니다/,
  /선납 및 자동이체 결제/,
  /구독\s*(신청|문의|하기)/,
  /무단\s*(전재|복제|배포)|재배포\s*금지/,
  /저작권자\s*[ⓒ©]/,
  /^[ⓒ©]\s*\S+/,
  /기자\s*$|기자\s*[a-z0-9._%+-]+@/i,
  /^\S+@\S+\.\S+$/, // 이메일만 있는 줄
  /뉴스레터\s*(구독|신청)/,
  /^(사진|자료)\s*=|^\[?사진\s*제공/,
  /카카오톡\s*채널|네이버\s*구독/,
];

// 링크 목록만 잔뜩 붙은 줄(푸터 메뉴 등)도 본문이 아님
function looksLikeLinkDump(p: string): boolean {
  const urls = (p.match(/https?:\/\//g) || []).length;
  if (urls >= 2) return true; // 한 문단에 링크 2개 이상 = 메뉴/푸터
  if (urls >= 1 && p.replace(/https?:\/\/\S+/g, "").trim().length < 20) return true;
  if (/href\s*=/.test(p)) return true; // 마크업이 그대로 새어나온 경우
  return false;
}

function isBoilerplate(p: string): boolean {
  if (looksLikeLinkDump(p)) return true;
  return BOILERPLATE.some((re) => re.test(p));
}

function extractParagraphs(html: string): string[] {
  // 1) JSON-LD articleBody 우선
  const ld = [...html.matchAll(
    /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )];
  let best = "";
  for (const m of ld) {
    try {
      const j = JSON.parse(m[1].trim());
      const arr = Array.isArray(j) ? j : j["@graph"] ? j["@graph"] : [j];
      for (const o of arr) {
        if (o && typeof o.articleBody === "string" && o.articleBody.length > best.length)
          best = o.articleBody;
      }
    } catch {
      /* skip */
    }
  }
  const candidates: string[][] = [];
  if (best.length > 200)
    candidates.push(dedupe(best.split(/\n+/).map((p) => p.trim())));

  // 2) Arc XP Fusion 본문 (조선비즈 등 JS 렌더 사이트)
  candidates.push(fusionParas(html));

  // 3) <p> 태그 추출
  candidates.push(
    dedupe([...html.matchAll(/<p[ >][\s\S]*?<\/p>/gi)].map((x) => clean(x[0]))),
  );

  // 4) itemprop=articleBody 컨테이너의 블록/<br> 텍스트 (edaily 등 div 본문)
  //    여는 태그 끝(>) 다음부터 잘라야 속성 텍스트가 안 섞임
  const idx = html.search(/itemprop=["']articleBody["']/i);
  if (idx >= 0) {
    const gt = html.indexOf(">", idx);
    if (gt >= 0) candidates.push(blockParas(html.slice(gt + 1, gt + 1 + 40000)));
  }

  // 본문을 가장 많이 건진 방식 채택
  return candidates.reduce(
    (bestPs, ps) => (totalLen(ps) > totalLen(bestPs) ? ps : bestPs),
    [] as string[],
  );
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return NextResponse.json({ ok: false, reason: "no-url" });

  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-url" });
  }
  // 구글뉴스 리다이렉트면 실제 기사 URL로 해석 (해석되면 화이트리스트 우회 — 집계 출처라 신뢰)
  if (isGoogleNewsUrl(u.toString())) {
    const real = await resolveGoogleNews(u.toString());
    if (!real) {
      return NextResponse.json({ ok: false, reason: "resolve-failed" });
    }
    try {
      u = new URL(real);
    } catch {
      return NextResponse.json({ ok: false, reason: "bad-url" });
    }
    if (!/^https?:$/.test(u.protocol)) {
      return NextResponse.json({ ok: false, reason: "not-allowed" });
    }
  } else if (!/^https?:$/.test(u.protocol) || !allowed(u.hostname)) {
    return NextResponse.json({ ok: false, reason: "not-allowed" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let html = "";
  let status = 0;
  try {
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 600 },
    });
    status = res.status;
    if (res.ok) html = await res.text();
  } catch {
    /* network/timeout */
  } finally {
    clearTimeout(timer);
  }

  if (!html) {
    return NextResponse.json({ ok: false, reason: "fetch-failed", status });
  }

  const titleEn = meta(html, "og:title") || decode((html.match(/<title>([^<]*)<\/title>/i) || [, ""])[1]).trim();
  const image = meta(html, "og:image") || null;
  let paras = extractParagraphs(html).filter((p) => !isBoilerplate(p));

  // 본문 분량 제한 (번역 부하/길이)
  let acc = 0;
  paras = paras.filter((p) => {
    if (acc > 6000 || paras.indexOf(p) > 40) return false;
    acc += p.length;
    return true;
  });

  if (paras.length === 0) {
    return NextResponse.json({ ok: false, reason: "no-content", status });
  }

  // lang=ko 일 때만 번역(해외 기사). 국내 기사는 원문 한국어 그대로.
  let title = titleEn;
  let body = paras;
  if (req.nextUrl.searchParams.get("lang") === "ko") {
    const tr = await translateMany([titleEn, ...paras]);
    title = tr[0] || titleEn;
    body = tr.slice(1);
  }

  return NextResponse.json(
    {
      ok: true,
      title,
      image,
      paragraphs: body,
      original: u.toString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
