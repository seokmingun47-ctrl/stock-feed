// 관심 뉴스 — 기업 티커 / 키워드로 개인 관심 피드 (계정별 localStorage)

export interface Interest {
  id: string; // `${kind}:${label 소문자}` — 자연 중복 방지
  label: string; // 표시용 (예: 삼성전자, 금리)
  kind: "ticker" | "keyword";
  terms: string[]; // 뉴스 제목·요약에서 매칭할 문자열들
}

const key = (username: string) => `stockfeed:interests:${username}`;

export function loadInterests(username: string): Interest[] {
  try {
    const raw = localStorage.getItem(key(username));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (x) => x && typeof x.label === "string" && Array.isArray(x.terms),
    );
  } catch {
    return [];
  }
}

export function saveInterests(username: string, list: Interest[]): void {
  try {
    localStorage.setItem(key(username), JSON.stringify(list.slice(0, 30)));
  } catch {
    /* noop */
  }
}

export function makeInterest(
  label: string,
  kind: "ticker" | "keyword",
  extraTerms: string[] = [],
): Interest | null {
  const clean = label.trim().slice(0, 30);
  if (!clean) return null;
  const terms = [
    clean,
    ...extraTerms.map((t) => t.trim()).filter(Boolean),
  ]
    .filter(Boolean)
    .map((t) => t.toLowerCase());
  return {
    id: `${kind}:${clean.toLowerCase()}`,
    label: clean,
    kind,
    terms: [...new Set(terms)],
  };
}

// 기사가 관심 목록 중 하나라도 매칭되는지
export function matchesInterests(
  title: string,
  summary: string,
  interests: Interest[],
): boolean {
  if (!interests.length) return false;
  const text = `${title} ${summary || ""}`.toLowerCase();
  return interests.some((it) => it.terms.some((t) => text.includes(t)));
}
