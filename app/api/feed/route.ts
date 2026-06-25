import { NextRequest, NextResponse } from "next/server";
import { SOURCES, sourcesByIds } from "@/lib/sources";
import { fetchSource } from "@/lib/rss";
import type { Article } from "@/lib/types";

export const runtime = "nodejs";
export const revalidate = 60;

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

  return NextResponse.json(
    {
      count: articles.length,
      // 상한을 넉넉히 — 단일 소스 필터 시 그 소스 기사가 누락되지 않도록.
      articles: articles.slice(0, 500),
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
