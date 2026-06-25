import { NextRequest, NextResponse } from "next/server";
import { SOURCES, SOURCE_MAP, sourcesByIds } from "@/lib/sources";
import { fetchSource } from "@/lib/rss";
import { translateMany } from "@/lib/translate";
import type { Article } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 60;
// 서울 리전에서 실행 — 한국 언론사 피드(예: 한국경제)가 해외 IP를 차단/지연하므로
// 한국 IP에서 요청해야 안정적. 글로벌 피드는 CDN이라 영향 없음.
export const preferredRegion = "icn1";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const param = req.nextUrl.searchParams.get("sources");
  const ids = param
    ? param.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const sources = ids.length ? sourcesByIds(ids) : SOURCES;

  const results = await Promise.all(sources.map((s) => fetchSource(s)));

  // 합치고 → 링크 기준 중복 제거 → 최신순 정렬
  const seen = new Set<string>();
  const articles: Article[] = [];
  for (const list of results) {
    for (const a of list) {
      if (seen.has(a.link)) continue;
      seen.add(a.link);
      articles.push(a);
    }
  }
  articles.sort((a, b) => b.publishedAt - a.publishedAt);

  // 상한을 넉넉히 — 단일 소스 필터 시 그 소스 기사가 누락되지 않도록.
  const top = articles.slice(0, 500);

  // lang=ko 이면 해외(영문) 기사의 제목·요약을 한국어로 번역.
  if (req.nextUrl.searchParams.get("lang") === "ko") {
    const globals = top.filter(
      (a) => SOURCE_MAP[a.sourceId]?.region === "global",
    );
    if (globals.length) {
      const texts: string[] = [];
      for (const a of globals) texts.push(a.title, a.summary || "");
      const tr = await translateMany(texts);
      let i = 0;
      for (const a of globals) {
        a.title = tr[i++] || a.title;
        a.summary = tr[i++] || a.summary;
      }
    }
  }

  return NextResponse.json(
    {
      count: articles.length,
      articles: top,
      okSources: sources
        .filter((s, i) => results[i].length > 0)
        .map((s) => s.id),
    },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
