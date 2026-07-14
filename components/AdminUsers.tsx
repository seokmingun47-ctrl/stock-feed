"use client";

import { useEffect } from "react";
import Avatar from "./Avatar";

export interface Signup {
  id: string;
  username: string;
  email: string | null;
  createdAt: number;
}

function fmtDate(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminUsers({
  users,
  onClose,
}: {
  users: Signup[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
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
            <div className="text-[16px] font-bold text-text">가입자 관리</div>
            <div className="text-[11px] text-muted">총 {users.length}명 · 최근 가입순</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-8">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
              <p className="text-[15px] font-bold text-text">아직 가입자가 없어요</p>
            </div>
          ) : (
            users.map((u, i) => (
              <div
                key={u.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3"
              >
                <span className="w-6 text-[12px] font-bold text-muted">{i + 1}</span>
                <Avatar name={u.username} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-bold text-text">
                    {u.username}
                  </div>
                  <div className="truncate text-[12.5px] text-muted">
                    {u.email || "이메일 없음"}
                  </div>
                </div>
                <span className="shrink-0 text-[11px] text-muted">
                  {fmtDate(u.createdAt)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
