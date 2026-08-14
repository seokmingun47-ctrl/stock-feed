import { NextRequest, NextResponse } from "next/server";
import { translateMany } from "@/lib/translate";
import {
  decode,
  meta,
  extractParagraphs,
  isBoilerplate,
  trimTrailingHeadlines,
} from "@/lib/readable";
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
  "benzinga.com",
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
  "sedaily.com",
  "heraldcorp.com",
  "newspim.com",
  "etoday.co.kr",
  "ajunews.com",
  "newsis.com",
  "bizwatch.co.kr",
];

function allowed(host: string): boolean {
  return ALLOWED.some((d) => host === d || host.endsWith("." + d));
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
  // 1) 광고/코드/링크뭉치 제거 → 2) 뒤에 붙은 '다른 기사 헤드라인 목록' 절단
  let paras = trimTrailingHeadlines(
    extractParagraphs(html).filter((p) => !isBoilerplate(p)),
  );

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
