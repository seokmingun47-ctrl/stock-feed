import { translateMany } from "./translate";

// 경제 캘린더 이벤트 (정규화)
export interface EconEvent {
  id: string;
  date: string; // ISO (타임존 포함)
  country: string; // USD, EUR, JPY ...
  title: string; // 한국어(번역 실패 시 원문)
  titleEn: string;
  impact: number; // 3=★★★ 2=★★☆ 1=★☆☆ 0=휴장/기타
  forecast: string; // 예상
  previous: string; // 이전
}

// 무료·키 불필요. 이번 주 일정만 제공(약 100건).
const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface FFRaw {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
}

function impactOf(s: string | undefined): number {
  switch ((s || "").toLowerCase()) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0; // Holiday / None
  }
}

// 국가(통화코드) → 한국어
export const COUNTRY_KO: Record<string, string> = {
  USD: "미국",
  EUR: "유로존",
  JPY: "일본",
  GBP: "영국",
  CNY: "중국",
  KRW: "한국",
  AUD: "호주",
  CAD: "캐나다",
  CHF: "스위스",
  NZD: "뉴질랜드",
};

// 이번 주 경제 일정. lang="ko"면 제목을 한국어로 번역.
export async function getEconEvents(lang = "ko"): Promise<EconEvent[]> {
  let raw: FFRaw[] = [];
  try {
    const res = await fetch(FF_URL, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 900 }, // 15분 캐시
    });
    if (!res.ok) return [];
    const j = await res.json();
    if (!Array.isArray(j)) return [];
    raw = j as FFRaw[];
  } catch {
    return [];
  }

  const events: EconEvent[] = raw
    .filter((e) => e.title && e.date)
    .map((e, i) => ({
      id: `${e.date}-${e.country}-${i}`,
      date: String(e.date),
      country: String(e.country || ""),
      title: String(e.title),
      titleEn: String(e.title),
      impact: impactOf(e.impact),
      forecast: String(e.forecast ?? ""),
      previous: String(e.previous ?? ""),
    }));

  if (lang !== "ko" || events.length === 0) return events;

  // 제목 한국어 번역 (translate.ts가 메모리 캐시 + 실패 시 원문 유지)
  try {
    const ko = await translateMany(events.map((e) => e.titleEn));
    events.forEach((e, i) => {
      if (ko[i]) e.title = ko[i];
    });
  } catch {
    /* 번역 실패 시 원문 그대로 */
  }
  return events;
}
