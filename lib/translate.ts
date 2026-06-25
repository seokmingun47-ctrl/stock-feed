// 영문 뉴스 → 한국어 번역 (구글 무료 엔드포인트, 키 불필요).
// 핵심 최적화: 번역 결과를 메모리에 캐시 → 같은 기사 제목이 매 새로고침마다
// 반복되므로, 매 요청에서 "새로 등장한 텍스트"만 번역한다.

const memo = new Map<string, string>(); // 원문 → 한국어
const MAX_MEMO = 6000;

function clean(t: string): string {
  // 줄바꿈을 구분자로 쓰므로 내부 개행/공백은 단일 공백으로
  return t.replace(/\s+/g, " ").trim();
}

// 영문이 거의 없으면(이미 한국어 등) 번역 불필요
function looksEnglish(t: string): boolean {
  const ascii = (t.match(/[A-Za-z]/g) || []).length;
  return ascii >= 2 && !/[가-힣]/.test(t);
}

// 한 번 호출. 성공하면 번역 배열, 실패/경계불일치면 null.
async function gtxRaw(texts: string[]): Promise<string[] | null> {
  const q = texts.join("\n");
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" +
    encodeURIComponent(q);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as [Array<[string, ...unknown[]]>];
    const segs = data[0];
    if (!Array.isArray(segs)) return null;
    const full = segs.map((s) => (s && s[0]) || "").join("");
    const out = full.split("\n");
    // 경계가 어긋나면(번역기가 줄을 합치거나 나눔) 실패로 간주 → 호출부가 분할 재시도
    if (out.length !== texts.length) return null;
    return out.map((s, i) => s.trim() || texts[i]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 청크 번역. 실패하면 반으로 쪼개 재귀 재시도(끝까지 가면 개별 번역).
// 한 문장이 경계 문제를 일으켜도 그 문장만 원문 유지되고 나머지는 번역됨.
async function translateChunk(texts: string[]): Promise<string[]> {
  const r = await gtxRaw(texts);
  if (r) return r;
  if (texts.length <= 1) return texts; // 단일 문장도 실패 → 원문 유지
  const mid = Math.floor(texts.length / 2);
  const [a, b] = await Promise.all([
    translateChunk(texts.slice(0, mid)),
    translateChunk(texts.slice(mid)),
  ]);
  return [...a, ...b];
}

export async function translateMany(rawTexts: string[]): Promise<string[]> {
  const texts = rawTexts.map(clean);

  // 캐시에 없고 번역이 필요한(영문) 고유 텍스트만 추림
  const need = new Set<string>();
  for (const t of texts) {
    if (t && looksEnglish(t) && !memo.has(t)) need.add(t);
  }

  // URL 길이 한도를 고려해 ~1200자 단위로 청크
  const unique = [...need];
  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const t of unique) {
    if (len + t.length > 1200 && cur.length) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += t.length + 1;
  }
  if (cur.length) chunks.push(cur);

  // Google 무료 엔드포인트 차단(429) 방지 위해 동시 5개로 제한
  const CONC = 5;
  for (let i = 0; i < chunks.length; i += CONC) {
    const batch = chunks.slice(i, i + CONC);
    const results = await Promise.all(batch.map((c) => translateChunk(c)));
    batch.forEach((c, bi) => {
      const r = results[bi];
      c.forEach((orig, ci) => {
        const t = r[ci];
        // 실제로 번역된 경우만 캐시 — 실패분(원문 그대로)은 다음에 재시도
        if (t && t !== orig) memo.set(orig, t);
      });
    });
  }

  // 캐시 크기 제한 (오래된 것부터 정리)
  if (memo.size > MAX_MEMO) {
    let n = 0;
    for (const k of memo.keys()) {
      memo.delete(k);
      if (++n > 2000) break;
    }
  }

  // 원문 순서대로 번역 결과 매핑 (영문 아니거나 실패 시 원문 그대로)
  return texts.map((t) => (t && memo.has(t) ? (memo.get(t) as string) : t));
}
