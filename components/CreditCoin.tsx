// 크레딧 코인 아이콘 — 'c'(credit 첫 글자)를 코인에 새긴 모양.
// 코인은 currentColor로 칠해지고, 'c'는 hole 색으로 파냄.
export default function CreditCoin({
  size = 14,
  hole = "var(--bg-soft)",
  className,
}: {
  size?: number;
  hole?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      {/* 'c' — 오른쪽이 열린 호 */}
      <path
        d="M15.6 9.2a4.4 4.4 0 1 0 0 5.6"
        fill="none"
        stroke={hole}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
