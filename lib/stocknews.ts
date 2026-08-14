import { fetchSource } from "./rss";
import { SOURCE_MAP } from "./sources";
import type { Article, Source } from "./types";

// 종목명으로 구글뉴스(한국어) 검색 → 최근 기사. 실제 뉴스만 다루는 용도.
async function fetchQuery(q: string, limit: number): Promise<Article[]> {
  const base = SOURCE_MAP["gnews_kr"];
  if (!base) return [];
  const src: Source = {
    ...base,
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`,
  };
  try {
    return (await fetchSource(src)).slice(0, limit);
  } catch {
    return [];
  }
}

// 한 종목의 최근(기본 2일) 뉴스. 등락 사유 설명의 유일한 근거로 쓴다.
export async function stockNews(name: string, limit = 4): Promise<Article[]> {
  const arts = await fetchQuery(
    `${name} (주가 OR 실적 OR 급등 OR 급락 OR 상승 OR 하락 OR 수주 OR 공시 OR 목표주가 OR 계약) when:2d`,
    limit + 4,
  );
  const seen = new Set<string>();
  const out: Article[] = [];
  for (const a of arts) {
    const k = a.link || a.title;
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}
