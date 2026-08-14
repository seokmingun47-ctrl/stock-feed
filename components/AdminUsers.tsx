"use client";

import { useEffect, useState } from "react";
import Avatar from "./Avatar";

export interface Signup {
  id: string;
  username: string;
  email: string | null;
  createdAt: number;
  credits?: number | null;
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
  // 지급 후 잔액을 즉시 반영하기 위해 로컬 사본 유지
  const [list, setList] = useState<Signup[]>(users);
  useEffect(() => setList(users), [users]);

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

  const applyCredits = (id: string, credits: number) =>
    setList((prev) => prev.map((u) => (u.id === id ? { ...u, credits } : u)));

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
            <div className="text-[11px] text-muted">총 {list.length}명 · 최근 가입순 · 크레딧 지급</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-8">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
              <p className="text-[15px] font-bold text-text">아직 가입자가 없어요</p>
            </div>
          ) : (
            list.map((u, i) => (
              <UserRow key={u.id} u={u} rank={i + 1} onApply={applyCredits} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function UserRow({
  u,
  rank,
  onApply,
}: {
  u: Signup;
  rank: number;
  onApply: (id: string, credits: number) => void;
}) {
  const [amount, setAmount] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const grant = async () => {
    const add = Number(amount);
    if (!Number.isFinite(add) || add === 0) {
      setMsg("금액을 입력하세요");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, add }),
      });
      const d = await r.json();
      if (d.ok) {
        onApply(u.id, d.credits);
        setMsg(`지급 완료 · 잔액 ${Number(d.credits).toLocaleString()}`);
      } else {
        setMsg(d.reason || "실패했어요");
      }
    } catch {
      setMsg("네트워크 오류");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="w-6 text-[12px] font-bold text-muted">{rank}</span>
        <Avatar name={u.username} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-bold text-text">{u.username}</div>
          <div className="truncate text-[12.5px] text-muted">{u.email || "이메일 없음"}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[13px] font-bold text-accent">
            {u.credits === null || u.credits === undefined
              ? "—"
              : `${u.credits.toLocaleString()} C`}
          </div>
          <div className="text-[10.5px] text-muted">{fmtDate(u.createdAt)}</div>
        </div>
      </div>

      {/* 크레딧 지급 */}
      <div className="mt-2.5 flex items-center gap-1.5 pl-9">
        <input
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="h-8 w-24 rounded-lg border border-border bg-bg-soft px-2.5 text-[13px] text-text outline-none focus:border-accent"
          placeholder="크레딧"
        />
        {[1000, 5000].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setAmount(String(v))}
            className="h-8 rounded-lg bg-bg-soft px-2 text-[12px] font-bold text-muted hover:text-text"
          >
            +{v.toLocaleString()}
          </button>
        ))}
        <button
          type="button"
          onClick={grant}
          disabled={busy}
          className="h-8 rounded-lg bg-accent px-3 text-[12.5px] font-bold text-white disabled:opacity-50"
        >
          {busy ? "…" : "지급"}
        </button>
        {msg && <span className="ml-1 truncate text-[11.5px] text-muted">{msg}</span>}
      </div>
    </div>
  );
}
