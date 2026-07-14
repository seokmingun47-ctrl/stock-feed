"use client";

import { useEffect, useState } from "react";

interface Report {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  note: string | null;
  status: string;
  reporter: string;
  createdAt: number;
}

const TYPE_LABEL: Record<string, string> = {
  post: "게시글",
  news: "유저 뉴스",
  comment: "댓글",
  message: "그룹 메시지",
  user: "사용자",
};

function fmt(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminReports({ onClose }: { onClose: () => void }) {
  const [reports, setReports] = useState<Report[] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    fetch("/api/admin/reports", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setReports(d.ok ? d.reports : []))
      .catch(() => setReports([]));
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

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
            <div className="text-[16px] font-bold text-text">신고 관리</div>
            <div className="text-[11px] text-muted">
              총 {reports?.length ?? 0}건 · 최근순
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-8">
          {reports === null ? (
            <div className="py-16 text-center text-[13px] text-muted">불러오는 중…</div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
              <p className="text-[15px] font-bold text-text">접수된 신고가 없어요</p>
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#f6465d]/15 px-1.5 py-0.5 text-[11px] font-bold text-[#f6465d]">
                    {TYPE_LABEL[r.targetType] ?? r.targetType}
                  </span>
                  <span className="text-[14px] font-bold text-text">{r.reason}</span>
                  <span className="ml-auto text-[11px] text-muted">{fmt(r.createdAt)}</span>
                </div>
                {r.note && (
                  <p className="mt-1 text-[13px] text-text">{r.note}</p>
                )}
                <div className="mt-1 text-[11.5px] text-muted">
                  신고자: {r.reporter} · 대상 ID: {r.targetId.slice(0, 20)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
