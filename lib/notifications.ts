// 알림 — 관심(SAVE) 종목·키워드에 새 뉴스가 뜨면 벨 배지로 알려줌.
// 이미 본 기사 링크를 계정별 localStorage에 저장(새로 뜬 것만 '안읽음').

const key = (username: string) => `stockfeed:notif-seen:${username}`;

export function loadSeen(username: string): Set<string> {
  try {
    const raw = localStorage.getItem(key(username));
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

export function saveSeen(username: string, links: string[]): void {
  try {
    // 최근 400개만 유지 (무한 증가 방지)
    localStorage.setItem(key(username), JSON.stringify(links.slice(-400)));
  } catch {
    /* noop */
  }
}
