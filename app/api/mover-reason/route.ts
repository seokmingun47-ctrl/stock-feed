import { NextRequest, NextResponse } from "next/server";
import { geminiRace } from "@/lib/gemini";
import { chargeAI } from "@/lib/credits";
import { fetchSource } from "@/lib/rss";
import { translateMany } from "@/lib/translate";
import { SOURCE_MAP } from "@/lib/sources";
import { getUser } from "@/lib/auth";
import type { Article, Source } from "@/lib/types";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 30;

interface MoverReason {
  summary: string;
  points: string[]; // 각 항목에 [뉴스N] 인용 필수
}

// 급등/급락 사유는 반드시 '실제 뉴스'에 근거해야 한다 (모델 추측 금지).
async function moverNews(name: string): Promise<Article[]> {
  const base = SOURCE_MAP["gnews_kr"];
  if (!base) return [];
  const src: Source = {
    ...base,
    // 최근 3일로 좁혀야 오늘의 급등락과 무관한 옛 기사가 안 섞임
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      `${name} (주가 OR 급등 OR 급락 OR 상승 OR 하락) when:3d`,
    )}&hl=ko&gl=KR&ceid=KR:ko`,
  };
  let arts: Article[] = [];
  try {
    arts = (await fetchSource(src)).slice(0, 8);
  } catch {
    return [];
  }
  if (arts.length) {
    try {
      const texts: string[] = [];
      for (const a of arts) texts.push(a.title, a.summary || "");
      const tr = await translateMany(texts);
      let i = 0;
      for (const a of arts) {
        a.title = tr[i++] || a.title;
        a.summary = tr[i++] || a.summary;
      }
    } catch {
      /* 번역 실패해도 원문 사용 */
    }
  }
  return arts;
}

function buildPrompt(
  name: string,
  dir: "up" | "down",
  changeRate: number,
  news: Article[],
): string {
  const word = dir === "up" ? "급등" : "급락";
  const newsBlock = news.length
    ? news
        .map(
          (a, i) =>
            `[뉴스${i + 1}] ${a.title}${a.summary ? `\n  요약: ${a.summary.slice(0, 200)}` : ""}`,
        )
        .join("\n")
    : "(관련 뉴스 없음)";

  return `당신은 '제공된 뉴스'만 정리하는 도구입니다. 아래 [최근 뉴스]에 실제로 있는 내용 외에는 어떤 사실·원인·전망도 쓰지 마세요. 당신의 배경지식으로 추측하지 마세요.

[종목] ${name}
[오늘 등락률] ${changeRate > 0 ? "+" : ""}${changeRate.toFixed(2)}% (${word})

[최근 뉴스] ← 오직 이 안에 있는 내용만 사용
${newsBlock}

이 종목이 오늘 ${word}한 이유를 위 뉴스에서 찾아 설명하세요.

규칙(반드시 지킬 것):
- **[최근 뉴스]에 문장으로 실제 존재하는 내용만** 쓸 것.
- 각 항목 끝에 근거 뉴스 번호를 반드시 붙일 것. 예) "3분기 영업이익이 시장 예상을 웃돌았다 [뉴스2]"
- 뉴스에 ${word} 사유가 없으면 **points를 빈 배열 []로 두고**, summary에 "관련 뉴스에서 뚜렷한 사유를 찾지 못했어요"라고 쓸 것.
  억지로 지어내지 말 것. 빈 배열이 틀린 내용보다 낫다.
- 주가 예측·투자 권유("오를 것/사라") 금지. 이미 보도된 사실만.
- 뉴스가 이 종목과 무관하면 사용하지 말 것.

아래 JSON만 응답:
{"summary":"1~2문장 요약","points":["뉴스에 나온 사유 [뉴스N]","..."]}`;
}

function parse(raw: string, newsCount: number): MoverReason | null {
  const clean = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const o = JSON.parse(clean) as { summary?: unknown; points?: unknown };
    const summary = String(o.summary ?? "").trim().slice(0, 400);
    // 인용 없는 항목은 지어낸 것으로 보고 폐기
    const points = Array.isArray(o.points)
      ? o.points
          .map((p) => String(p).trim())
          .filter((p) => {
            if (!p) return false;
            const m = p.match(/\[뉴스\s*(\d+)\]/);
            if (!m) return false;
            const n = Number(m[1]);
            return n >= 1 && n <= newsCount;
          })
          .slice(0, 5)
      : [];
    if (!summary && !points.length) return null;
    return { summary, points };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, reason: "no-key" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const name = String(body.name ?? "").trim().slice(0, 40);
  const dir: "up" | "down" = body.dir === "down" ? "down" : "up";
  const changeRate = Number(body.changeRate);
  if (!name) {
    return NextResponse.json({ ok: false, reason: "종목 정보가 없어요." }, { status: 400 });
  }

  // 급등락 사유는 프로 전용
  const user = await getUser(req);
  if (!user?.isPro) {
    return NextResponse.json(
      { ok: false, reason: "급등·급락 사유 분석은 프로 전용이에요.", code: "PRO_ONLY" },
      { status: 403 },
    );
  }

  const charge = await chargeAI(req);
  if (!charge.ok) {
    return NextResponse.json(
      { ok: false, reason: charge.reason, code: charge.code, credits: charge.credits },
      { status: charge.status ?? 402 },
    );
  }

  const news = await moverNews(name);
  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(name, dir, Number.isFinite(changeRate) ? changeRate : 0, news) },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      maxOutputTokens: 900,
    },
  });
  const out = await geminiRace(apiKey, requestBody);
  if (!out) {
    await charge.refund?.();
    return NextResponse.json(
      { ok: false, reason: "AI가 잠시 혼잡해요. 다시 시도해 주세요." },
      { status: 503 },
    );
  }
  const reason = parse(out, news.length);
  if (!reason) {
    await charge.refund?.();
    return NextResponse.json({ ok: false, reason: "AI 응답을 해석하지 못했어요." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, dir, reason, news, credits: charge.credits });
}
