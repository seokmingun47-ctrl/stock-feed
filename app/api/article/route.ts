import { NextRequest, NextResponse } from "next/server";
import { translateMany } from "@/lib/translate";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// SSRF 방지: 알려진 해외 뉴스 도메인만 허용
const ALLOWED = [
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
    return best
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 40);
  }

  // 2) <p> 태그 추출 폴백
  const ps = [...html.matchAll(/<p[ >][\s\S]*?<\/p>/gi)]
    .map((x) => decode(x[0].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim())
    .filter((t) => t.length > 40)
    .filter((t) => !/cookie|subscribe|newsletter|sign up|sign in|©|all rights reserved|terms of|privacy policy/i.test(t));
  // 연속 중복 제거
  const out: string[] = [];
  for (const p of ps) if (out[out.length - 1] !== p) out.push(p);
  return out;
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

  // 제목 + 문단 한국어 번역
  const tr = await translateMany([titleEn, ...paras]);
  const titleKo = tr[0] || titleEn;
  const bodyKo = tr.slice(1);

  return NextResponse.json(
    {
      ok: true,
      title: titleKo,
      image,
      paragraphs: bodyKo,
      original: u.toString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
  );
}
