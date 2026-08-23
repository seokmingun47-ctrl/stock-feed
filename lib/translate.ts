// 영문 뉴스 → 한국어 번역.
//
// 예전에는 구글 무료 엔드포인트(translate_a/single)를 썼는데, 지금은 봇으로 막혀
// "Sorry..." HTML 을 돌려줍니다. 실패하면 원문을 그대로 두는 구조라 영어 제목이
// 조용히 남아 있었습니다. 그래서 이미 쓰고 있는 Gemini 로 옮겼습니다.
//
// 핵심 최적화는 그대로입니다. 번역 결과를 메모리에 캐시해서, 매 요청에서
// "새로 등장한 텍스트"만 번역합니다.

import { geminiRace } from "./gemini";

const memo = new Map<string, string>(); // 원문 → 한국어
const MAX_MEMO = 6000;

function clean(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

// 영문이 거의 없으면(이미 한국어 등) 번역 불필요
function looksEnglish(t: string): boolean {
  const ascii = (t.match(/[A-Za-z]/g) || []).length;
  return ascii >= 2 && !/[가-힣]/.test(t);
}

const PROMPT = [
  "다음은 증권·경제 뉴스의 제목이나 요약입니다. 각 줄을 한국어로 번역하세요.",
  "",
  "규칙:",
  "- 입력과 똑같은 번호를 붙여 같은 줄 수로 출력합니다.",
  "- 번역문만 출력합니다. 설명·따옴표·원문 병기 금지.",
  "- 기업명·인명·티커는 국내 언론에서 쓰는 표기를 따르고, 애매하면 원문을 그대로 둡니다.",
  "- 뉴스 제목투로 간결하게 옮깁니다.",
].join("\n");

/**
 * 한 묶음 번역. 성공하면 번역 배열, 실패하면 null.
 *
 * 줄바꿈만으로 자르면 번역기가 줄을 합치거나 나눌 때 순서가 어긋납니다.
 * 그래서 번호를 붙여 보내고 번호로 되찾습니다.
 */
async function translateRaw(texts: string[]): Promise<string[] | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const body = JSON.stringify({
    contents: [{ parts: [{ text: `${PROMPT}\n\n${numbered}` }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 8000 },
  });

  const out = await geminiRace(key, body);
  if (!out) return null;

  // "3. 금리가 다시 주목받는다" 같은 줄에서 번호와 본문을 분리
  const found = new Map<number, string>();
  for (const line of out.split("\n")) {
    const m = line.match(/^\s*(\d+)\s*[.)]\s*(.+)$/);
    if (!m) continue;
    const idx = Number(m[1]) - 1;
    const text = m[2].trim();
    if (idx >= 0 && idx < texts.length && text) found.set(idx, text);
  }
  if (found.size === 0) return null;

  // 일부만 돌아와도 그 줄만 번역으로 채우고 나머지는 원문을 씁니다.
  return texts.map((t, i) => found.get(i) ?? t);
}

// 실패하면 반으로 쪼개 재시도. 한 문장이 문제를 일으켜도 나머지는 살립니다.
async function translateChunk(texts: string[]): Promise<string[]> {
  const r = await translateRaw(texts);
  if (r) return r;
  if (texts.length <= 1) return texts;
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

  // 한 번에 보낼 묶음. POST 본문이라 예전 URL 방식보다 넉넉하게 잡습니다.
  const unique = [...need];
  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const t of unique) {
    if ((len + t.length > 4000 || cur.length >= 40) && cur.length) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += t.length + 1;
  }
  if (cur.length) chunks.push(cur);

  const CONC = 4;
  for (let i = 0; i < chunks.length; i += CONC) {
    const batch = chunks.slice(i, i + CONC);
    const results = await Promise.all(batch.map((c) => translateChunk(c)));
    batch.forEach((c, bi) => {
      const r = results[bi];
      c.forEach((orig, ci) => {
        const t = r[ci];
        // 실제로 번역된 것만 캐시 — 실패분(원문 그대로)은 다음에 재시도
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

  return texts.map((t) => (t && memo.has(t) ? (memo.get(t) as string) : t));
}
