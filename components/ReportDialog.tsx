"use client";

import { useState } from "react";
import { REPORT_REASONS, type ReportTargetType } from "@/lib/moderation";

export default function ReportDialog({
  targetType,
  targetId,
  targetLabel,
  onClose,
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    setErr("");
    try {
      const d = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, note }),
      }).then((r) => r.json());
      if (!d.ok) {
        setErr(d.reason || "신고에 실패했어요.");
        setBusy(false);
        return;
      }
      setDone(true);
      setTimeout(onClose, 1400);
    } catch {
      setErr("네트워크 오류예요.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="sheet-up mx-auto w-full max-w-[600px] rounded-t-2xl border-t border-border bg-bg pb-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <span className="text-[16px] font-bold text-text">신고하기</span>
          <button onClick={onClose} aria-label="닫기" className="text-muted hover:text-text">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[15px] font-bold text-text">신고가 접수됐어요</p>
            <p className="mt-1 text-[13px] text-muted">검토 후 조치할게요. 감사합니다.</p>
          </div>
        ) : (
          <div className="px-4 py-4">
            {targetLabel && (
              <p className="mb-2 text-[13px] text-muted">대상: {targetLabel}</p>
            )}
            <p className="mb-2 text-[13.5px] font-semibold text-text">신고 사유</p>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[14.5px] transition-colors ${
                    reason === r
                      ? "border-accent bg-accent/10 font-semibold text-text"
                      : "border-border text-muted hover:bg-bg-soft"
                  }`}
                >
                  <span
                    className={`grid h-4 w-4 place-items-center rounded-full border ${
                      reason === r ? "border-accent" : "border-border"
                    }`}
                  >
                    {reason === r && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  {r}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="상세 내용 (선택)"
              className="mt-3 w-full resize-none rounded-xl border border-border bg-bg-soft px-3.5 py-2.5 text-[14px] text-text outline-none placeholder:text-muted focus:border-accent"
            />
            {err && <p className="mt-2 text-[13px] text-[var(--down)]">{err}</p>}
            <button
              onClick={submit}
              disabled={!reason || busy}
              className="mt-3 w-full rounded-xl bg-[#f6465d] py-3 text-[15px] font-bold text-white disabled:opacity-40"
            >
              {busy ? "접수 중…" : "신고 제출"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
