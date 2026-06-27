export function timeAgo(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 0) return "방금";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(ms);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}
