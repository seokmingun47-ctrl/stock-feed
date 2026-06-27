import { NextRequest, NextResponse } from "next/server";
import { translateMany } from "@/lib/translate";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// SSRF 방지: 알려진 뉴스 도메인만 허용
const ALLOWED = [
  // 해외
  "investing.com",
  "cnbc.com",
  "bbc.co.uk",
  "bbc.com",
  "bloomberg.com",
  "yahoo.com",
  "marketwatch.com",
  "nasdaq.com",
  "businessinsider.com",
  "fool.com",
  "seekingalpha.com",
  "ft.com",
  // 국내
  "hankyung.com",
  "yna.co.kr",
  "edaily.co.kr",
  "chosun.com",
  "fnnews.com",
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
  if (best.length > 200) {
    return dedupe(best.split(/\n+/).map((p) => p.trim()));
  }

  // 2) <p> 태그 추출
  const pPs = dedupe(
    [...html.matchAll(/<p[ >][\s\S]*?<\/p>/gi)].map((x) => clean(x[0])),
  );

  // 3) itemprop=articleBody 컨테이너의 블록/<br> 텍스트 (edaily 등 div 본문)
  let containerPs: string[] = [];
  const idx = html.search(/itemprop=["']articleBody["']/i);
  if (idx >= 0) containerPs = blockParas(html.slice(idx, idx + 40000));

  // 더 많은 본문을 건진 쪽 채택
  return totalLen(containerPs) > totalLen(pPs) ? containerPs : pPs;
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
  if (!/^https?:$/.test(u.protocol) || !allowed(u.hostname)) {
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
  let paras = extractParagraphs(html);

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
