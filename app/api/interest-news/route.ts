import { NextRequest, NextResponse } from "next/server";
import { fetchSource } from "@/lib/rss";
import { translateMany } from "@/lib/translate";
import { SOURCE_MAP } from "@/lib/sources";
import type { Article, Source } from "@/lib/types";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

// 관심 종목·키워드로 구글 뉴스(인앱에 없는 매체 포함)를 긁어옴.
// 결과는 gnews_kr 소스로 태깅 → 리더가 실제 URL 해석+본문추출+한국어 번역해 인앱에서 바로 읽힘.
export async function POST(req: NextRequest) {
  let body: { terms?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const terms = Array.isArray(body.terms)
    ? [
        ...new Set(
          body.terms
            .map((t) => String(t).trim())
            .filter((t) => t.length >= 1),
        ),
      ].slice(0, 8)
    : [];
  if (!terms.length) return NextResponse.json({ ok: true, articles: [] });

  const base = SOURCE_MAP["gnews_kr"];
  const perTerm = await Promise.all(
    terms.map(async (term) => {
      const src: Source = {
        ...base,
        url: `https://news.google.com/rss/search?q=${encodeURIComponent(
          term,
        )}&hl=ko&gl=KR&ceid=KR:ko`,
      };
      const arts = await fetchSource(src);
      return arts.slice(0, 12);
    }),
  );

  // 병합 + 링크 중복 제거 + 최신순
  const seen = new Set<string>();
  const articles: Article[] = [];
  for (const list of perTerm) {
    for (const a of list) {
      if (seen.has(a.link)) continue;
      seen.add(a.link);
      articles.push(a);
    }
  }
  articles.sort((a, b) => b.publishedAt - a.publishedAt);
  const top = articles.slice(0, 45);

  // 제목·요약 한국어로 (구글뉴스에 영어 섞일 수 있음. 한국어는 그대로 통과)
  if (top.length) {
    const texts: string[] = [];
    for (const a of top) texts.push(a.title, a.summary || "");
    const tr = await translateMany(texts);
    let i = 0;
    for (const a of top) {
      a.title = tr[i++] || a.title;
      a.summary = tr[i++] || a.summary;
    }
  }

  return NextResponse.json(
    { ok: true, articles: top },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    },
  );
}
