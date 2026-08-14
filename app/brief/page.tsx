"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Brief {
  date: string;
  name: string;
  summary: string;
  usIndices: { name: string; changeRate: number | null }[];
  watch: { name: string; changeRate: number | null; reason: string }[];
  events: { title: string; country: string }[];
  sources: { n: number; title: string; link: string }[];
}

function pct(v: number | null): string {
  if (v == null) return "-";
  return `${v > 0 ? "+" : ""}${v}%`;
}
function color(v: number | null): string {
  if (v == null) return "var(--muted)";
  return v > 0 ? "#f6465d" : v < 0 ? "#4b91f7" : "var(--muted)";
}

export default function BriefPage() {
  const [state, setState] = useState<"loading" | "ok" | "login" | "pro" | "error">("loading");
  const [brief, setBrief] = useState<Brief | null>(null);

  useEffect(() => {
    fetch("/api/brief", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 401) return setState("login");
        if (r.status === 403) return setState("pro");
        const d = await r.json();
        if (d.ok) {
          setBrief(d);
          setState("ok");
        } else setState("error");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-[600px] bg-bg px-5 py-8 text-text">
      <div className="mb-6 flex items-center justify-between">
        <div className="text-[15px] font-extrabold">
          <span className="text-text">New</span>
          <span className="text-accent">sync</span>
        </div>
        <Link href="/" className="text-[13px] font-semibold text-accent">
          앱으로 →
        </Link>
      </div>

      {state === "loading" && (
        <div className="py-24 text-center text-[14px] text-muted">브리핑을 준비하고 있어요…</div>
      )}

      {state === "login" && (
        <Center title="로그인이 필요해요" desc="로그인하면 오늘의 브리핑을 볼 수 있어요.">
          <Link href="/?login=1" className="btn">
            로그인하기
          </Link>
        </Center>
      )}

      {state === "pro" && (
        <Center title="아침 브리핑은 프로 기능이에요" desc="프로로 업그레이드하면 매일 아침 브리핑을 받아요.">
          <Link href="/pricing" className="btn">
            요금제 보기
          </Link>
        </Center>
      )}

      {state === "error" && (
        <Center title="브리핑을 불러오지 못했어요" desc="잠시 후 다시 시도해 주세요.">
          <button onClick={() => location.reload()} className="btn">
            다시 시도
          </button>
        </Center>
      )}

      {state === "ok" && brief && (
        <>
          <div className="text-[13px] text-muted">{brief.date}</div>
          <h1 className="mt-1 text-[24px] font-extrabold">{brief.name}님의 아침 브리핑</h1>

          <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-text/90">
            {brief.summary}
          </p>

          {brief.usIndices.length > 0 && (
            <Section title="미국 증시 마감">
              {brief.usIndices.map((i) => (
                <RowKV key={i.name} k={i.name} v={pct(i.changeRate)} c={color(i.changeRate)} />
              ))}
            </Section>
          )}

          {brief.watch.length > 0 && (
            <Section title="내 관심종목 — 왜 움직였나">
              {brief.watch.map((w) => (
                <div key={w.name} className="border-b border-border/60 py-2.5 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-bold text-text">{w.name}</span>
                    <span className="text-[14.5px] font-bold" style={{ color: color(w.changeRate) }}>
                      {pct(w.changeRate)}
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{w.reason}</p>
                </div>
              ))}
            </Section>
          )}

          {brief.sources.length > 0 && (
            <Section title="뉴스 출처">
              {brief.sources.map((s) => (
                <a
                  key={s.n}
                  href={s.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-1.5 text-[12.5px] leading-snug text-muted hover:text-text"
                >
                  [뉴스{s.n}] {s.title}
                </a>
              ))}
            </Section>
          )}

          {brief.events.length > 0 && (
            <Section title="오늘 주요 경제일정">
              {brief.events.map((e, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 text-[14px]">
                  <span className="rounded bg-bg-soft px-1.5 py-0.5 text-[11px] font-bold text-muted">
                    {e.country}
                  </span>
                  <span className="text-text/90">{e.title}</span>
                </div>
              ))}
            </Section>
          )}

          <p className="mt-8 text-[11.5px] leading-relaxed text-muted">
            제공되는 정보는 투자 참고용이며 투자 권유가 아닙니다. 투자 판단과 책임은 이용자 본인에게 있습니다.
          </p>
        </>
      )}

      <style>{`.btn{display:inline-block;background:var(--accent);color:#fff;font-weight:700;font-size:14px;padding:11px 22px;border-radius:12px;text-decoration:none;}`}</style>
    </main>
  );
}

function Center({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-[16px] font-bold text-text">{title}</p>
      <p className="text-[13.5px] text-muted">{desc}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-border bg-bg-soft/40 p-4">
      <h2 className="mb-1 text-[13px] font-bold text-muted">{title}</h2>
      {children}
    </section>
  );
}

function RowKV({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-[14.5px]">
      <span className="text-text/90">{k}</span>
      <span className="font-bold" style={{ color: c }}>
        {v}
      </span>
    </div>
  );
}
