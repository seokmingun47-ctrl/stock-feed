"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Room, User } from "@/lib/community";
import { timeAgo } from "@/lib/format";
import { uploadImage } from "@/lib/upload";
import ChatRoom from "./ChatRoom";
import RoomIcon from "./RoomIcon";

export default function GroupRooms({ user }: { user: User }) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await fetch("/api/rooms", { cache: "no-store" }).then((r) => r.json());
      if (!d.ok) {
        setErr(d.reason || "불러오지 못했어요.");
        setRooms([]);
        return;
      }
      setRooms(d.rooms);
    } catch {
      setErr("네트워크 오류예요.");
      setRooms([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dbMissing = err && /group_rooms|relation|table|no-db/i.test(err);

  return (
    <div className="mx-auto flex min-h-screen max-w-[600px] flex-col bg-bg pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 py-3.5 backdrop-blur">
        <h1 className="text-[19px] font-extrabold tracking-tight text-text">
          그룹방
        </h1>
        <p className="text-[12px] text-muted">관심사가 맞는 사람들과 실시간 대화</p>
      </header>

      <main className="flex-1">
        {rooms === null ? (
          <SkeletonList />
        ) : dbMissing ? (
          <Notice
            title="그룹방 준비 중"
            desc="DB 테이블을 아직 만들지 않았어요. 설정이 끝나면 바로 이용할 수 있어요."
          />
        ) : err ? (
          <Notice title="불러오지 못했어요" desc={err} onRetry={load} />
        ) : rooms.length === 0 ? (
          <Notice
            title="아직 그룹방이 없어요"
            desc="첫 그룹방을 만들어 대화를 시작해보세요!"
          />
        ) : (
          rooms.map((r) => (
            <RoomCard key={r.id} room={r} onOpen={() => setOpen(r)} />
          ))
        )}
      </main>

      {/* 방 만들기 FAB */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[84px] z-40 mx-auto max-w-[600px] px-4">
        <button
          onClick={() => setCreating(true)}
          className="pointer-events-auto ml-auto flex h-14 items-center gap-2 rounded-full bg-accent px-5 text-white shadow-lg shadow-accent/30"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          <span className="text-[15px] font-bold">방 만들기</span>
        </button>
      </div>

      {open && (
        <ChatRoom
          room={open}
          user={user}
          onClose={() => {
            setOpen(null);
            load();
          }}
          onDeleted={(id) => {
            setOpen(null);
            setRooms((cur) => (cur ? cur.filter((r) => r.id !== id) : cur));
          }}
        />
      )}
      {creating && (
        <CreateRoom
          onClose={() => setCreating(false)}
          onCreated={(room) => {
            setCreating(false);
            setRooms((cur) => (cur ? [room, ...cur] : [room]));
            setOpen(room);
          }}
        />
      )}
    </div>
  );
}

function RoomCard({ room, onOpen }: { room: Room; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left transition-colors hover:bg-bg-soft active:bg-bg-soft"
    >
      <RoomIcon icon={room.emoji} name={room.name} size={48} radius={16} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[16px] font-bold text-text">
            {room.name}
          </span>
          <span className="shrink-0 text-[12px] text-muted">
            · {room.memberCount}명
          </span>
        </div>
        <p className="truncate text-[13px] text-muted">
          {room.lastBody || room.description || "새 그룹방"}
        </p>
      </div>
      {room.lastAt > 0 && (
        <span className="shrink-0 text-[11px] text-muted">
          {timeAgo(room.lastAt)}
        </span>
      )}
    </button>
  );
}

function CreateRoom({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (room: Room) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (files: FileList | null) => {
    if (!files || !files[0]) return;
    setErr("");
    setUploading(true);
    try {
      const url = await uploadImage(files[0], "post");
      setImage(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!name.trim() || busy || uploading) return;
    setBusy(true);
    setErr("");
    try {
      const d = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, emoji: image || "" }),
      }).then((r) => r.json());
      if (!d.ok) {
        setErr(d.reason || "개설에 실패했어요.");
        setBusy(false);
        return;
      }
      onCreated(d.room);
    } catch {
      setErr("네트워크 오류예요.");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60">
      <button aria-label="닫기" onClick={onClose} className="flex-1" />
      <div className="sheet-up rounded-t-2xl border-t border-border bg-bg pb-6">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <span className="text-[17px] font-bold text-text">그룹방 개설</span>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="rounded-full bg-accent px-4 py-1.5 text-[14px] font-bold text-white disabled:opacity-40"
          >
            {busy ? "개설 중…" : "개설"}
          </button>
        </div>
        <div className="px-4 py-4">
          {/* 아이콘 미리보기 + 사진 첨부 */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pick(e.target.files)}
          />
          {image && (
            <div className="relative mb-3 h-20 w-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="" className="h-full w-full rounded-2xl object-cover" />
              <button
                onClick={() => setImage(null)}
                aria-label="사진 삭제"
                className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mb-4 flex items-center gap-2 rounded-full bg-bg-soft px-4 py-2 text-[13.5px] font-semibold text-muted hover:text-text disabled:opacity-60"
          >
            {uploading ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="spin">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            )}
            {uploading ? "올리는 중…" : image ? "사진 변경" : "사진 추가 (선택)"}
          </button>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            placeholder="방 이름 (예: 삼성전자 장기투자방)"
            className="w-full rounded-xl border border-border bg-bg-soft px-3.5 py-3 text-[16px] font-semibold text-text outline-none placeholder:text-muted focus:border-accent"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            rows={2}
            placeholder="방 소개 (선택)"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-bg-soft px-3.5 py-3 text-[15px] leading-relaxed text-text outline-none placeholder:text-muted focus:border-accent"
          />
          {err && <p className="mt-3 text-[13px] text-[var(--down)]">{err}</p>}
        </div>
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-bg-soft" />
          <div className="flex-1">
            <div className="mb-2 h-4 w-32 rounded bg-bg-soft" />
            <div className="h-3 w-48 rounded bg-bg-soft" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Notice({
  title,
  desc,
  onRetry,
}: {
  title: string;
  desc: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
      <p className="text-[17px] font-bold text-text">{title}</p>
      <p className="mt-2 text-[14px] text-muted">{desc}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-5 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold text-white"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}
