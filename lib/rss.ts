import { XMLParser } from "fast-xml-parser";
import type { Article, Source } from "./types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  // CDATA 등은 fast-xml-parser가 자동 처리. 일부 항목은 배열/단일이 섞이므로 헬퍼로 정규화.
});

function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o["#text"] === "string") return o["#text"] as string;
  }
  return "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&"); // amp 마지막: 이중 디코딩 방지
}

function stripHtml(s: string): string {
  return decodeEntities(
    s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function firstImage(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

// 본문 없는 자리표시 글 스킵 (예: trumpstruth.org 미디어/리트윗 "[No Title] - Post from …")
function isPlaceholder(title: string): boolean {
  return /^\[no title\]/i.test(title.trim());
}

function pickAtomLink(entry: Record<string, unknown>): string {
  const links = asArray(entry.link as unknown);
  for (const l of links) {
    if (typeof l === "object" && l) {
      const o = l as Record<string, unknown>;
      const rel = o["@_rel"];
      if (!rel || rel === "alternate") return text(o["@_href"]) || text(o);
    } else if (typeof l === "string") {
      return l;
    }
  }
  return links.length ? text(links[0]) : "";
}

function toTime(raw: string): number {
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

export function parseFeed(xml: string, source: Source): Article[] {
  let data: Record<string, unknown>;
  try {
    data = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }

  const out: Article[] = [];

  // RSS 2.0: rss > channel > item[]
  const rss = data.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  const rssItems = asArray(channel?.item as unknown);

  // Atom: feed > entry[]
  const feed = data.feed as Record<string, unknown> | undefined;
  const atomEntries = asArray(feed?.entry as unknown);

  // 구글뉴스 피드(도메인 또는 검색 URL) — 제목 끝 " - 출처명" 제거 대상
  const isGNews =
    source.domain === "news.google.com" || /news\.google\.com/.test(source.url);
  for (const it of rssItems) {
    const item = it as Record<string, unknown>;
    let title = stripHtml(text(item.title));
    // 구글뉴스 제목 끝 " - 출처명" 제거 (번역 전 → 출처명 오역 방지)
    if (isGNews && title.includes(" - ")) {
      const parts = title.split(" - ");
      title = parts.slice(0, -1).join(" - ");
    }
    const link = text(item.link) || text((item.guid as unknown));
    if (!title || !link || isPlaceholder(title)) continue;
    const descRaw =
      text(item["content:encoded"]) || text(item.description) || "";
    const img =
      mediaImage(item) ?? firstImage(descRaw) ?? null;
    out.push({
      id: `${source.id}:${link}`,
      sourceId: source.id,
      title,
      link: link.trim(),
      summary: stripHtml(descRaw).slice(0, 180),
      image: img,
      publishedAt: toTime(text(item.pubDate) || text(item["dc:date"])),
    });
  }

  for (const en of atomEntries) {
    const entry = en as Record<string, unknown>;
    const title = stripHtml(text(entry.title));
    const link = pickAtomLink(entry);
    if (!title || !link || isPlaceholder(title)) continue;
    const descRaw = text(entry.content) || text(entry.summary) || "";
    out.push({
      id: `${source.id}:${link}`,
      sourceId: source.id,
      title,
      link: link.trim(),
      summary: stripHtml(descRaw).slice(0, 180),
      image: firstImage(descRaw),
      publishedAt: toTime(
        text(entry.published) || text(entry.updated),
      ),
    });
  }

  return out;
}

function mediaImage(item: Record<string, unknown>): string | null {
  const candidates = [
    item["media:content"],
    item["media:thumbnail"],
    item["enclosure"],
  ];
  for (const c of candidates) {
    for (const m of asArray(c as unknown)) {
      if (typeof m === "object" && m) {
        const url = (m as Record<string, unknown>)["@_url"];
        if (typeof url === "string" && /^https?:/.test(url)) return url;
      }
    }
  }
  return null;
}

export async function fetchSource(source: Source): Promise<Article[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        // 일부 피드(예: Nasdaq)가 봇 UA를 차단 → 실제 브라우저 UA 사용
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseFeed(xml, source);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
