export type Region = "kr" | "global";

export interface Source {
  id: string;
  name: string;        // 전체 이름 (예: 한국경제)
  handle: string;      // @핸들 표기
  category: string;    // 분류 (예: 증권·금융)
  region: Region;
  url: string;         // RSS 피드 주소
  domain: string;      // 파비콘/로고용 도메인
  color: string;       // 브랜드 색 (폴백 아바타)
}

export interface Article {
  id: string;
  sourceId: string;
  title: string;
  link: string;
  summary: string;
  image: string | null;
  publishedAt: number; // epoch ms
}
