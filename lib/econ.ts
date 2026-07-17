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

// 주요 지표는 기계번역이 어색해서(예: Overnight Rate→"하룻밤 요금") 직접 매핑.
// 여기 없는 항목만 번역기로 넘어감.
const GLOSSARY: Record<string, string> = {
  "overnight rate": "기준금리",
  "official bank rate": "기준금리",
  "federal funds rate": "연방기금금리",
  "main refinancing rate": "기준금리",
  "cash rate": "기준금리",
  "rate statement": "통화정책 성명",
  "monetary policy statement": "통화정책 성명",
  "monetary policy report": "통화정책 보고서",
  "press conference": "기자회견",
  "rate decision": "금리 결정",
  "cpi m/m": "소비자물가지수 (전월대비)",
  "cpi y/y": "소비자물가지수 (전년대비)",
  "core cpi m/m": "근원 소비자물가지수 (전월대비)",
  "core cpi y/y": "근원 소비자물가지수 (전년대비)",
  "ppi m/m": "생산자물가지수 (전월대비)",
  "ppi y/y": "생산자물가지수 (전년대비)",
  "core ppi m/m": "근원 생산자물가지수 (전월대비)",
  "unemployment claims": "신규 실업수당 청구건수",
  "unemployment rate": "실업률",
  "non-farm employment change": "비농업부문 고용변화",
  "average hourly earnings m/m": "시간당 평균임금 (전월대비)",
  "retail sales m/m": "소매판매 (전월대비)",
  "core retail sales m/m": "근원 소매판매 (전월대비)",
  "empire state manufacturing index": "엠파이어스테이트 제조업지수",
  "philly fed manufacturing index": "필라델피아 연준 제조업지수",
  "industrial production m/m": "산업생산 (전월대비)",
  "building permits": "건축허가건수",
  "housing starts": "주택착공건수",
  "existing home sales": "기존주택 판매",
  "new home sales": "신규주택 판매",
  "consumer confidence": "소비자신뢰지수",
  "trade balance": "무역수지",
  "crude oil inventories": "원유 재고",
  "natural gas storage": "천연가스 재고",
  "flash manufacturing pmi": "제조업 PMI (속보)",
  "flash services pmi": "서비스업 PMI (속보)",
  "ism manufacturing pmi": "ISM 제조업 PMI",
  "ism services pmi": "ISM 서비스업 PMI",
  "bank holiday": "휴장",
};

// "BOC Rate Statement" 처럼 중앙은행 약어가 앞에 붙은 형태도 용어집을 타게 함
const BANK_PREFIX = /^(BOC|BOE|BOJ|ECB|RBA|RBNZ|SNB|FOMC|Fed|NBS|PBOC)\s+(.+)$/i;

function lookupGlossary(en: string): string | null {
  const t = en.trim();
  const direct = GLOSSARY[t.toLowerCase()];
  if (direct) return direct;
  const m = t.match(BANK_PREFIX);
  if (m) {
    const rest = GLOSSARY[m[2].trim().toLowerCase()];
    if (rest) return `${m[1].toUpperCase()} ${rest}`;
  }
  return null;
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

  // 1) 용어집 우선 적용
  const needTranslate: number[] = [];
  events.forEach((e, i) => {
    const hit = lookupGlossary(e.titleEn);
    if (hit) e.title = hit;
    else needTranslate.push(i);
  });

  // 2) 나머지만 번역 (translate.ts가 메모리 캐시 + 실패 시 원문 유지)
  if (needTranslate.length) {
    try {
      const ko = await translateMany(needTranslate.map((i) => events[i].titleEn));
      needTranslate.forEach((idx, k) => {
        if (ko[k]) events[idx].title = ko[k];
      });
    } catch {
      /* 번역 실패 시 원문 그대로 */
    }
  }
  return events;
}
