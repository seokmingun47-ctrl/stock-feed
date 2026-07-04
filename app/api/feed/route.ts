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

  // 번역 대상: 집계(hidden, 예 구글뉴스)는 토글과 무관하게 항상 한국어,
  // 일반 해외(global)는 lang=ko 일 때만.
  const langKo = req.nextUrl.searchParams.get("lang") === "ko";
  const targets = top.filter((a) => {
    const s = SOURCE_MAP[a.sourceId];
    if (!s) return false;
    if (s.hidden) return true;
    return langKo && s.region === "global";
  });
  if (targets.length) {
    const texts: string[] = [];
    for (const a of targets) texts.push(a.title, a.summary || "");
    const tr = await translateMany(texts);
    let i = 0;
    for (const a of targets) {
      a.title = tr[i++] || a.title;
      a.summary = tr[i++] || a.summary;
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
