// 영문 뉴스 → 한국어 번역.
//
// 왜 또 영어가 그대로 남았나:
//  1) Gemini 무료 키 하나로 요약·채팅·브리핑까지 다 쓰는데, 번역은 한 번의 피드
//     요청에서 수십 번 호출해서 제일 먼저 429(한도 초과)를 맞는다.
//  2) 실패하면 원문을 그대로 두는 구조 + 로그 한 줄 없음 → 조용히 영어로 남는다.
//  3) 실패할 때마다 묶음을 반으로 쪼개 재시도해서 호출이 오히려 배로 늘었다
//     (한도에 걸린 상황에서 가장 하면 안 되는 행동).
//  4) 캐시가 인스턴스 메모리뿐이라 서버가 바뀌면 처음부터 다시 번역했다.
//
// 그래서:
//  - 공급자 3단 폴백(NVIDIA → Gemini → Groq). 하나가 막혀도 번역이 끊기지 않는다.
//  - 번역 결과를 Supabase 에 저장(2차 캐시). 인스턴스가 바뀌어도 살아남아서
//    같은 기사를 다시 번역하지 않는다 → 호출량 자체가 줄어 한도를 안 맞는다.
//  - 공급자가 막힌 실패는 쪼개지 않는다. 쪼개는 건 '응답은 왔는데 형식이 깨진' 때만.
//  - 마감 시한을 둬서 maxDuration(30초) 안에 끝낸다. 못 끝낸 건 다음 요청에서
//    이어서 채우고, 한 번 번역된 건 캐시에 남으므로 금방 수렴한다.
//  - 실패하면 이유를 로그로 남긴다. (Vercel 로그에서 `[translate]` 검색)

import { createHash } from "node:crypto";
import { aiText } from "./textai";
import { groqChat } from "./groq";
import { getAdminClient, isSupabaseConfigured } from "./supabase";

const memo = new Map<string, string>(); // 원문 → 한국어 (1차: 인스턴스 메모리)
const MAX_MEMO = 6000;

function clean(t: string): string {
  return t.replace(/\s+/g, " ").trim();
}

// 영문이 거의 없으면(이미 한국어 등) 번역 불필요
function looksEnglish(t: string): boolean {
  const ascii = (t.match(/[A-Za-z]/g) || []).length;
  return ascii >= 2 && !/[가-힣]/.test(t);
}

function hashOf(t: string): string {
  return createHash("sha256").update(t).digest("hex");
}

/* ───────────────────────── 2차 캐시 (Supabase) ───────────────────────── */

const TABLE = "translations";
// 스키마가 아직 안 깔렸거나 접근이 막히면 이번 프로세스에선 더 건드리지 않는다.
let dbOff = !isSupabaseConfigured();

async function dbLoad(texts: string[]): Promise<void> {
  if (dbOff || !texts.length) return;
  const byHash = new Map(texts.map((t) => [hashOf(t), t]));
  const hashes = [...byHash.keys()];
  try {
    const sb = getAdminClient();
    for (let i = 0; i < hashes.length; i += 200) {
      const { data, error } = await sb
        .from(TABLE)
        .select("hash, ko")
        .in("hash", hashes.slice(i, i + 200));
      if (error) {
        console.warn("[translate] 캐시 읽기 실패 —", error.message);
        dbOff = true;
        return;
      }
      for (const row of data ?? []) {
        const src = byHash.get(row.hash as string);
        if (src && row.ko) memo.set(src, row.ko as string);
      }
    }
  } catch (e) {
    console.warn("[translate] 캐시 읽기 예외 —", (e as Error).message);
    dbOff = true;
  }
}

async function dbSave(pairs: Array<[string, string]>): Promise<void> {
  if (dbOff || !pairs.length) return;
  try {
    const rows = pairs.map(([src, ko]) => ({
      hash: hashOf(src),
      src: src.slice(0, 2000),
      ko,
    }));
    const { error } = await getAdminClient()
      .from(TABLE)
      .upsert(rows, { onConflict: "hash" });
    if (error) console.warn("[translate] 캐시 저장 실패 —", error.message);
  } catch (e) {
    console.warn("[translate] 캐시 저장 예외 —", (e as Error).message);
  }
}

/* ───────────────────────── 공급자 폴백 ───────────────────────── */

const PROMPT = [
  "다음은 증권·경제 뉴스의 제목이나 요약입니다. 각 줄을 한국어로 번역하세요.",
  "",
  "규칙:",
  "- 입력과 똑같은 번호를 붙여 같은 줄 수로 출력합니다.",
  "- 번역문만 출력합니다. 설명·따옴표·원문 병기 금지.",
  "- 기업명·인명·티커는 국내 언론에서 쓰는 표기를 따르고, 애매하면 원문을 그대로 둡니다.",
  "- 뉴스 제목투로 간결하게 옮깁니다.",
].join("\n");

/** NVIDIA → Gemini → Groq 순으로 물어본다. 전부 실패하면 null. */
async function ask(
  prompt: string,
  maxTokens: number,
  timeoutMs: number,
  why: string[],
): Promise<string | null> {
  // aiText 가 NVIDIA 먼저, 실패하면 Gemini 를 시도한다.
  const a = await aiText(prompt, { maxTokens, timeoutMs });
  if (a) return a;
  why.push("nvidia·gemini 모두 실패");

  const gk = process.env.GROQ_API_KEY;
  if (!gk) {
    why.push("groq 키 없음");
    return null;
  }
  const g = await groqChat(
    gk,
    [
      { role: "system", content: "You are a translator. Follow the output format exactly." },
      { role: "user", content: prompt },
    ],
    { maxTokens, temperature: 0 },
  );
  if (!g) why.push("groq 실패");
  return g;
}

/** "3. 금리가 다시 주목받는다" 같은 줄에서 번호와 본문을 분리 */
function parseNumbered(out: string, n: number): Map<number, string> {
  const found = new Map<number, string>();
  const body = out.replace(/```[a-z]*\n?/gi, "").replace(/```/g, "");
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*(\d+)\s*[.)]\s*(.+)$/);
    if (!m) continue;
    const idx = Number(m[1]) - 1;
    const text = m[2].trim();
    if (idx >= 0 && idx < n && text) found.set(idx, text);
  }
  if (found.size === 0) {
    // 번호를 빼먹었어도 줄 수가 맞으면 순서대로 맞춘다.
    const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === n) lines.forEach((l, i) => found.set(i, l));
  }
  return found;
}

/**
 * 한 묶음 번역.
 *
 * 줄바꿈만으로 자르면 번역기가 줄을 합치거나 나눌 때 순서가 어긋난다.
 * 그래서 번호를 붙여 보내고 번호로 되찾는다.
 */
async function translateChunk(
  texts: string[],
  deadline: number,
  depth = 0,
): Promise<string[]> {
  if (Date.now() >= deadline) return texts;

  const numbered = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const maxTokens = Math.min(8000, 600 + numbered.length * 2);
  const left = deadline - Date.now();
  const why: string[] = [];

  const out = await ask(
    `${PROMPT}\n\n${numbered}`,
    maxTokens,
    Math.max(5000, Math.min(20000, left)),
    why,
  );

  // 공급자가 막힌 것 → 여기서 쪼개면 호출만 배로 늘어 한도를 더 세게 맞는다.
  if (!out) {
    console.warn(`[translate] ${texts.length}줄 실패 — ${why.join(", ")}`);
    return texts;
  }

  const found = parseNumbered(out, texts.length);

  // 응답은 왔는데 형식이 깨진 경우에만 한 번 쪼개 재시도.
  if (found.size === 0 && texts.length > 1 && depth < 1) {
    const mid = Math.floor(texts.length / 2);
    const [a, b] = await Promise.all([
      translateChunk(texts.slice(0, mid), deadline, depth + 1),
      translateChunk(texts.slice(mid), deadline, depth + 1),
    ]);
    return [...a, ...b];
  }
  if (found.size === 0) console.warn("[translate] 응답에서 번역을 못 찾음");

  // 일부만 돌아와도 그 줄만 번역으로 채우고 나머지는 원문을 쓴다.
  return texts.map((t, i) => found.get(i) ?? t);
}

/**
 * 영문 텍스트 묶음을 한국어로. 번역 못 한 건 원문 그대로 돌려준다.
 * budgetMs: 이 호출에 허용된 시간(라우트의 maxDuration 안에 들어와야 한다).
 */
export async function translateMany(
  rawTexts: string[],
  budgetMs = 18000,
): Promise<string[]> {
  const texts = rawTexts.map(clean);
  const deadline = Date.now() + budgetMs;

  // 캐시에 없고 번역이 필요한(영문) 고유 텍스트만 추림 — 입력 순서 유지
  const need: string[] = [];
  const picked = new Set<string>();
  for (const t of texts) {
    if (t && looksEnglish(t) && !memo.has(t) && !picked.has(t)) {
      picked.add(t);
      need.push(t);
    }
  }

  await dbLoad(need);
  const todo = need.filter((t) => !memo.has(t));

  // 한 번에 보낼 묶음. 묶음이 클수록 호출 수가 줄어 한도에 안 걸린다.
  const chunks: string[][] = [];
  let cur: string[] = [];
  let len = 0;
  for (const t of todo) {
    if ((len + t.length > 6000 || cur.length >= 60) && cur.length) {
      chunks.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(t);
    len += t.length + 1;
  }
  if (cur.length) chunks.push(cur);

  const fresh: Array<[string, string]> = [];
  const CONC = 3;
  for (let i = 0; i < chunks.length; i += CONC) {
    if (Date.now() >= deadline) {
      console.warn(
        `[translate] 시간 초과 — ${chunks.length - i}묶음은 다음 요청에서 이어서`,
      );
      break;
    }
    const batch = chunks.slice(i, i + CONC);
    const results = await Promise.all(
      batch.map((c) => translateChunk(c, deadline)),
    );
    batch.forEach((c, bi) => {
      c.forEach((orig, ci) => {
        const t = results[bi][ci];
        // 실제로 번역된 것만 캐시 — 실패분(원문 그대로)은 다음에 재시도
        if (t && t !== orig) {
          memo.set(orig, t);
          fresh.push([orig, t]);
        }
      });
    });
  }

  if (todo.length && fresh.length < todo.length) {
    console.warn(`[translate] ${todo.length}건 중 ${fresh.length}건만 번역됨`);
  }
  await dbSave(fresh);

  // 캐시 크기 제한 (오래된 것부터 정리)
  if (memo.size > MAX_MEMO) {
    let n = 0;
    for (const k of memo.keys()) {
      memo.delete(k);
      if (++n > 2000) break;
    }
  }

  return texts.map((t) => memo.get(t) ?? t);
}
