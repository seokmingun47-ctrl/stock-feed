"use client";

import { useEffect, useState } from "react";

interface Stats {
  ok: boolean;
  reason?: string;
  generatedAt: number;
  users: {
    total: number;
    today: number | null;
    d7: number | null;
    d30: number | null;
    pro: number | null;
  };
  trend: { date: string; count: number }[];
  adoption: {
    brief: number | null;
    alerts: number | null;
    adRewards: number | null;
    push: number | null;
  };
  credits: { sum: number; avg: number; low: number } | null;
  subs: {
    active: number;
    canceled: number;
    pastDue: number;
    dueIn7d: number;
    mrr: number;
  } | null;
  revenue: { count: number; total: number; last30: number } | null;
  reports: { total: number; pending: number } | null;
  community: {
    posts: number | null;
    comments: number | null;
    newsComments: number | null;
  };
}

const n = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : v.toLocaleString();

const won = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${v.toLocaleString()}원`;

function fmtTime(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminDashboard({
  onClose,
  onOpenUsers,
  onOpenReports,
}: {
  onClose: () => void;
  onOpenUsers?: () => void;
  onOpenReports?: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fetch("/api/admin/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Stats) => {
        if (d.ok) setStats(d);
        else setFailed(d.reason || "불러오지 못했어요.");
      })
      .catch(() => setFailed("불러오지 못했어요."));
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const maxTrend = Math.max(1, ...(stats?.trend ?? []).map((t) => t.count));

  return (
    <div className="reader-enter fixed inset-0 z-[70] flex flex-col bg-bg">
      <div className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-text hover:bg-bg-soft"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-bold text-text">관리자 대시보드</div>
            <div className="text-[11px] text-muted">
              {stats ? `${fmtTime(stats.generatedAt)} 기준` : "집계 중…"}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4">
          {failed ? (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
              <p className="text-[15px] font-bold text-text">{failed}</p>
              <p className="mt-1 text-[12.5px] text-muted">
                데이터베이스 연결을 확인해 주세요.
              </p>
            </div>
          ) : !stats ? (
            <div className="py-16 text-center text-[13px] text-muted">불러오는 중…</div>
          ) : (
            <>
              {/* 핵심 지표 */}
              <div className="grid grid-cols-2 gap-2">
                <Stat label="총 가입자" value={n(stats.users.total)} unit="명" strong />
                <Stat label="오늘 신규" value={n(stats.users.today)} unit="명" accent />
                <Stat label="최근 7일" value={n(stats.users.d7)} unit="명" />
                <Stat label="최근 30일" value={n(stats.users.d30)} unit="명" />
              </div>

              {/* 가입 추이 */}
              {stats.trend.length > 0 && (
                <Section title="최근 14일 가입 추이">
                  <div className="flex h-[110px] items-end gap-[3px]">
                    {stats.trend.map((t) => (
                      <div
                        key={t.date}
                        className="group flex flex-1 flex-col items-center justify-end gap-1"
                        title={`${t.date} · ${t.count}명`}
                      >
                        <span className="text-[10px] font-bold text-muted">
                          {t.count > 0 ? t.count : ""}
                        </span>
                        <div
                          className={`w-full rounded-t ${t.count > 0 ? "bg-accent" : "bg-border"}`}
                          style={{
                            height: `${Math.max(t.count > 0 ? 6 : 2, (t.count / maxTrend) * 76)}px`,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10px] text-muted">
                    <span>{stats.trend[0]?.date}</span>
                    <span>{stats.trend[stats.trend.length - 1]?.date}</span>
                  </div>
                </Section>
              )}

              {/* 구독 · 수익 */}
              {(stats.subs || stats.revenue) && (
                <Section title="구독 · 수익">
                  <div className="grid grid-cols-2 gap-2">
                    {stats.subs && (
                      <>
                        <Stat label="활성 구독" value={n(stats.subs.active)} unit="명" accent />
                        <Stat label="월 반복 매출" value={won(stats.subs.mrr)} />
                        <Stat label="7일 내 결제 예정" value={n(stats.subs.dueIn7d)} unit="건" />
                        <Stat
                          label="결제 실패"
                          value={n(stats.subs.pastDue)}
                          unit="건"
                          danger={stats.subs.pastDue > 0}
                        />
                      </>
                    )}
                    {stats.revenue && (
                      <>
                        <Stat label="누적 결제" value={won(stats.revenue.total)} />
                        <Stat label="최근 30일" value={won(stats.revenue.last30)} />
                      </>
                    )}
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted">
                    프로 회원 {n(stats.users.pro)}명 · 결제 {n(stats.revenue?.count)}건
                  </p>
                </Section>
              )}

              {/* 기능 사용 */}
              {stats.adoption && (
                <Section title="기능 사용">
                  <div className="grid grid-cols-2 gap-2">
                    <Stat
                      label="아침 브리핑 구독"
                      value={n(stats.adoption.brief)}
                      unit="명"
                    />
                    <Stat
                      label="관심종목 알림"
                      value={n(stats.adoption.alerts)}
                      unit="명"
                    />
                    <Stat
                      label="광고 리워드 시청"
                      value={n(stats.adoption.adRewards)}
                      unit="회"
                    />
                    <Stat
                      label="웹푸시 등록"
                      value={n(stats.adoption.push)}
                      unit="건"
                    />
                  </div>
                </Section>
              )}

              {/* AI 크레딧 */}
              {stats.credits && (
                <Section title="AI 크레딧">
                  <div className="grid grid-cols-3 gap-2">
                    <Stat label="총 잔액" value={n(stats.credits.sum)} />
                    <Stat label="1인 평균" value={n(stats.credits.avg)} />
                    <Stat
                      label="소진 임박"
                      value={n(stats.credits.low)}
                      unit="명"
                      danger={stats.credits.low > 0}
                    />
                  </div>
                  <p className="mt-2 text-[11.5px] text-muted">
                    잔액 100 미만이면 소진 임박으로 셉니다 (요약·분석 1회 25).
                  </p>
                </Section>
              )}

              {/* 커뮤니티 */}
              <Section title="커뮤니티">
                <div className="grid grid-cols-3 gap-2">
                  <Stat label="게시글" value={n(stats.community.posts)} />
                  <Stat label="댓글" value={n(stats.community.comments)} />
                  <Stat label="뉴스 댓글" value={n(stats.community.newsComments)} />
                </div>
              </Section>

              {/* 바로가기 */}
              <div className="mt-5 overflow-hidden rounded-xl border border-border">
                {onOpenUsers && (
                  <button
                    onClick={onOpenUsers}
                    className="flex w-full items-center gap-2 border-b border-border px-4 py-3.5 text-left hover:bg-bg-soft"
                  >
                    <span className="flex-1 text-[15px] font-bold text-text">
                      가입자 관리
                    </span>
                    <span className="text-[12px] text-muted">
                      {n(stats.users.total)}명
                    </span>
                  </button>
                )}
                {onOpenReports && (
                  <button
                    onClick={onOpenReports}
                    className="flex w-full items-center gap-2 px-4 py-3.5 text-left hover:bg-bg-soft"
                  >
                    <span className="flex-1 text-[15px] font-bold text-text">
                      신고 관리
                    </span>
                    {stats.reports && stats.reports.pending > 0 ? (
                      <span className="grid h-[20px] min-w-[20px] place-items-center rounded-full bg-[#f6465d] px-1.5 text-[11px] font-black text-white">
                        {stats.reports.pending}
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted">
                        {n(stats.reports?.total)}건
                      </span>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-5">
      <h2 className="mb-2 text-[13px] font-bold text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  unit,
  strong = false,
  accent = false,
  danger = false,
}: {
  label: string;
  value: string;
  unit?: string;
  strong?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  const color = danger ? "text-[#f6465d]" : accent ? "text-accent" : "text-text";
  return (
    <div className="rounded-xl border border-border bg-bg-soft px-3.5 py-3">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div
        className={`mt-0.5 font-black ${color} ${strong ? "text-[24px]" : "text-[20px]"}`}
      >
        {value}
        {unit && (
          <span className="ml-0.5 text-[12px] font-bold text-muted">{unit}</span>
        )}
      </div>
    </div>
  );
}
