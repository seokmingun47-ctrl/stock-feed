// Newsync 로고 마크 — 그라데이션 스퀘어클 + 기하학적 N 모노그램 + 라이브 점
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
      style={{ borderRadius: size * 0.28 }}
    >
      <defs>
        <linearGradient
          id="newsyncGrad"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#5b54f0" />
          <stop offset="1" stopColor="#18b6e6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#newsyncGrad)" />
      {/* 기하학적 N */}
      <path
        d="M13 28 V13 L27 28 V13"
        stroke="white"
        strokeWidth="3.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* 라이브/싱크 점 */}
      <circle cx="28.5" cy="11.5" r="3" fill="#34e3a4" />
    </svg>
  );
}

// 마크 + "Newsync" 워드마크. tone에 따라 글자색만 다름.
export function Logo({
  size = 28,
  textClass = "text-text",
  syncClass = "text-accent",
  textSize = "text-[19px]",
}: {
  size?: number;
  textClass?: string;
  syncClass?: string;
  textSize?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className={`${textSize} font-extrabold tracking-tight`}>
        <span className={textClass}>New</span>
        <span className={syncClass}>sync</span>
      </span>
    </div>
  );
}
