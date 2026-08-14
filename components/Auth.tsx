"use client";

import { useEffect, useState } from "react";
import type { User } from "@/lib/community";
import { LogoMark } from "@/components/Logo";

// 구글 콜백이 실패하고 돌아올 때 붙는 코드 → 사람이 읽을 문장으로
const OAUTH_ERRORS: Record<string, string> = {
  google_off: "구글 로그인이 아직 설정되지 않았어요.",
  canceled: "구글 로그인을 취소했어요.",
  state: "보안 확인에 실패했어요. 다시 시도해 주세요.",
  token: "구글 인증에 실패했어요. 다시 시도해 주세요.",
  userinfo: "구글 계정 정보를 받지 못했어요.",
  email: "이메일이 확인되지 않은 구글 계정이에요.",
  create: "계정을 만들지 못했어요.",
  network: "네트워크 오류예요. 다시 시도해 주세요.",
  no_db: "서버 설정 문제로 로그인할 수 없어요.",
};

export default function Auth({
  onAuth,
  onClose,
}: {
  onAuth: (u: User) => void;
  onClose?: () => void; // 게스트가 기능을 누를 때 오버레이로 뜨는 경우
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showForm, setShowForm] = useState(false); // 아이디 방식은 접어둔다
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // 구글 콜백이 ?err=... 로 돌려보낸 실패 사유 표시
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const code = p.get("err");
      if (!code) return;
      setErr(OAUTH_ERRORS[code] || "로그인에 실패했어요.");
      p.delete("err");
      const q = p.toString();
      window.history.replaceState({}, "", window.location.pathname + (q ? `?${q}` : ""));
    } catch {
      /* noop */
    }
  }, []);

  const canSubmit =
    mode === "login"
      ? !!username.trim() && !!password
      : !!email.trim() && !!username.trim() && !!password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setErr("");
    try {
      const body =
        mode === "login"
          ? { username: username.trim(), password }
          : { username: username.trim(), email: email.trim(), password };
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "signup"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!d.ok) {
        setErr(d.reason || "실패했어요.");
        setBusy(false);
        return;
      }
      onAuth(d.user);
    } catch {
      setErr("네트워크 오류예요.");
      setBusy(false);
    }
  };

  const input =
    "w-full rounded-xl border border-[#e2e7ef] bg-white px-4 py-3.5 text-[16px] text-[#111725] outline-none transition-colors placeholder:text-[#a3adbd] focus:border-[#5b54f0]";

  return (
    <div className="min-h-screen bg-white px-5 py-6 text-[#111725]">
      {onClose && (
        <button
          onClick={onClose}
          aria-label="닫기"
          className="grid h-10 w-10 place-items-center rounded-full text-[#5f6b7d] transition-colors hover:bg-[#f1f4f9]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="mx-auto flex min-h-[78vh] max-w-[400px] flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            <LogoMark size={52} />
          </div>
          <h1 className="text-[26px] font-extrabold leading-snug tracking-tight">
            증권 뉴스를 한 곳에서
          </h1>
          <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#5f6b7d]">
            로그인하면 AI 요약과 종목 분석을
            <br />
            바로 이용할 수 있어요.
          </p>
        </div>

        {err && (
          <div className="mb-4 rounded-xl border border-[#f6465d]/25 bg-[#f6465d]/10 px-4 py-3 text-[13px] leading-relaxed text-[#d32f45]">
            {err}
          </div>
        )}

        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-2.5 rounded-xl border border-[#e2e7ef] bg-white py-3.5 text-[15px] font-bold text-[#111725] transition-colors hover:bg-[#f8fafc]"
        >
          <GoogleIcon />
          Google로 로그인
        </a>

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="mt-3 rounded-xl border border-[#e2e7ef] bg-white py-3.5 text-[15px] font-bold text-[#5f6b7d] transition-colors hover:bg-[#f8fafc]"
          >
            아이디로 로그인
          </button>
        ) : (
          <>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-[#eef1f6]" />
              <span className="text-[12px] text-[#a3adbd]">또는</span>
              <span className="h-px flex-1 bg-[#eef1f6]" />
            </div>

            <div className="mb-3 inline-flex w-full rounded-full bg-[#f1f4f9] p-1">
              {(
                [
                  ["login", "로그인"],
                  ["signup", "회원가입"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setMode(key);
                    setErr("");
                  }}
                  className={`flex-1 rounded-full py-2 text-[14px] font-bold transition-colors ${
                    mode === key ? "bg-white text-[#111725] shadow-sm" : "text-[#5f6b7d]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-2.5">
              {mode === "signup" && (
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  maxLength={120}
                  autoComplete="email"
                  placeholder="이메일"
                  className={input}
                />
              )}
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={mode === "login" ? 120 : 20}
                autoComplete="username"
                placeholder={mode === "login" ? "아이디 또는 이메일" : "아이디 (닉네임)"}
                className={input}
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                maxLength={100}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="비밀번호"
                className={input}
              />
              <button
                type="submit"
                disabled={busy || !canSubmit}
                className="w-full rounded-xl py-3.5 text-[15px] font-extrabold text-white transition-transform active:scale-[0.99] disabled:opacity-40"
                style={{ background: "linear-gradient(135deg,#5b54f0,#18b6e6)" }}
              >
                {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 시작하기"}
              </button>
            </form>

            {mode === "signup" && (
              <p className="mt-3 text-[12.5px] leading-relaxed text-[#a3adbd]">
                아이디는 영문/숫자/_/- 3~20자, 비밀번호는 4자 이상이에요.
              </p>
            )}
          </>
        )}

        <p className="mt-6 text-center text-[12px] leading-relaxed text-[#a3adbd]">
          로그인 시{" "}
          <a href="/terms" className="underline hover:text-[#5f6b7d]">
            이용약관
          </a>{" "}
          및{" "}
          <a href="/privacy" className="underline hover:text-[#5f6b7d]">
            개인정보 처리방침
          </a>
          에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
