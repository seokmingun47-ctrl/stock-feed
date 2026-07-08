"use client";

import { useEffect, useRef, useState } from "react";
import type { Room, GroupMessage, User } from "@/lib/community";
import Avatar from "./Avatar";

function fmtTime(ms: number): string {
  if (!ms) return "";
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "오전" : "오후";
  const hh = h % 12 || 12;
  return `${ap} ${hh}:${String(m).padStart(2, "0")}`;
}

export default function ChatRoom({
  room: initialRoom,
  user,
  onClose,
  onDeleted,
}: {
  room: Room;
  user: User;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [room, setRoom] = useState(initialRoom);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const seenIds = useRef<Set<string>>(new Set());
  const lastTs = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const canManage = user.isAdmin || (!!room.ownerId && room.ownerId === user.id);

  const scrollToBottom = (smooth = false) => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const merge = (incoming: GroupMessage[]) => {
    const fresh = incoming.filter((m) => !seenIds.current.has(m.id));
    if (!fresh.length) return;
    for (const m of fresh) {
      seenIds.current.add(m.id);
      if (m.createdAt > lastTs.current) lastTs.current = m.createdAt;
    }
    setMessages((cur) =>
      [...cur, ...fresh].sort((a, b) => a.createdAt - b.createdAt),
    );
  };

  // 입장(멤버 등록) + 초기 메시지
  useEffect(() => {
    const c = new AbortController();
    fetch(`/api/rooms/${room.id}`, { signal: c.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && d.room && setRoom(d.room))
      .catch(() => {});
    fetch(`/api/rooms/${room.id}/messages`, { signal: c.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) merge(d.messages ?? []);
        setLoaded(true);
        setTimeout(() => scrollToBottom(), 30);
      })
      .catch(() => setLoaded(true));
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  // 3초 폴링
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const d = await fetch(
          `/api/rooms/${room.id}/messages?after=${lastTs.current}`,
          { cache: "no-store" },
        ).then((r) => r.json());
        if (d.ok && d.messages?.length) {
          const before = atBottom.current;
          merge(d.messages);
          if (before) setTimeout(() => scrollToBottom(true), 30);
        }
      } catch {
        /* noop */
      }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

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

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setText("");
    try {
      const d = await fetch(`/api/rooms/${room.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      }).then((r) => r.json());
      if (d.ok && d.message) {
        merge([d.message]);
        setTimeout(() => scrollToBottom(true), 30);
      } else {
        setText(t);
        alert(d.reason || "전송 실패");
      }
    } catch {
      setText(t);
    } finally {
      setBusy(false);
    }
  };

  const deleteRoom = async () => {
    if (!window.confirm("이 방을 삭제할까요? 대화 내용도 모두 사라져요.")) return;
    const d = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" }).then((r) =>
      r.json(),
    );
    if (d.ok) onDeleted(room.id);
    else alert(d.reason || "삭제 실패");
  };

  return (
    <div className="reader-enter fixed inset-0 z-50 flex flex-col bg-bg">
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
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg-soft text-[16px]">
            {room.emoji || "💬"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-text">
              {room.name}
            </div>
            <div className="text-[11px] text-muted">참여 {room.memberCount}명</div>
          </div>
          {canManage && (
            <button
              onClick={deleteRoom}
              aria-label="방 삭제"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:text-[#f6465d]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
              </svg>
            </button>
          )}
        </header>

        <div
          ref={listRef}
          onScroll={onScroll}
          className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
        >
          {!loaded ? (
            <div className="py-10 text-center text-[13px] text-muted">불러오는 중…</div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <span className="mb-2 text-[36px]">{room.emoji || "💬"}</span>
              <p className="text-[15px] font-bold text-text">{room.name}</p>
              {room.description && (
                <p className="mt-1 px-8 text-[13px] text-muted">{room.description}</p>
              )}
              <p className="mt-3 text-[13px] text-muted">첫 메시지를 남겨보세요!</p>
            </div>
          ) : (
            messages.map((m, i) => {
              const mine = !!m.userId && m.userId === user.id;
              const prev = messages[i - 1];
              const grouped =
                prev &&
                prev.userId === m.userId &&
                m.createdAt - prev.createdAt < 60_000;
              return (
                <div
                  key={m.id}
                  className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}
                >
                  {!mine ? (
                    grouped ? (
                      <span className="w-8 shrink-0" />
                    ) : (
                      <Avatar
                        name={m.nickname}
                        avatarUrl={m.avatarUrl}
                        color={m.color}
                        size={32}
                      />
                    )
                  ) : null}
                  <div className={`flex max-w-[76%] flex-col ${mine ? "items-end" : "items-start"}`}>
                    {!mine && !grouped && (
                      <span className="mb-0.5 px-1 text-[12px] font-semibold text-muted">
                        {m.nickname}
                      </span>
                    )}
                    <div className="flex items-end gap-1.5">
                      {mine && (
                        <span className="text-[10px] text-muted">{fmtTime(m.createdAt)}</span>
                      )}
                      <span
                        className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[15px] leading-snug ${
                          mine
                            ? "rounded-br-md bg-accent text-white"
                            : "rounded-bl-md bg-bg-soft text-text"
                        }`}
                      >
                        {m.body}
                      </span>
                      {!mine && (
                        <span className="text-[10px] text-muted">{fmtTime(m.createdAt)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-border bg-bg px-3 py-2.5">
          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              maxLength={1000}
              placeholder="메시지 보내기…"
              className="min-w-0 flex-1 rounded-full border border-border bg-bg-soft px-4 py-2.5 text-[15px] text-text outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              onClick={send}
              disabled={!text.trim() || busy}
              aria-label="보내기"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-40"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
