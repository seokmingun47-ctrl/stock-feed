import Link from "next/link";

// 사업자 정보 — Vercel 환경변수에 실제 값을 넣으면 자동 표기됩니다.
// (통신판매업 신고 후 필수 표기 항목. 값이 없으면 이 블록은 아예 렌더되지 않아요.)
const BIZ = {
  name: process.env.NEXT_PUBLIC_BIZ_NAME, // 상호
  ceo: process.env.NEXT_PUBLIC_BIZ_CEO, // 대표자
  regNo: process.env.NEXT_PUBLIC_BIZ_REG_NO, // 사업자등록번호
  mailOrder: process.env.NEXT_PUBLIC_BIZ_MAIL_ORDER_NO, // 통신판매업 신고번호
  address: process.env.NEXT_PUBLIC_BIZ_ADDRESS, // 주소
  tel: process.env.NEXT_PUBLIC_BIZ_TEL, // 연락처
};
const EMAIL = process.env.NEXT_PUBLIC_BIZ_EMAIL || "skylee993393@gmail.com";

export default function SiteFooter() {
  const rows: [string, string | undefined][] = [
    ["상호", BIZ.name],
    ["대표자", BIZ.ceo],
    ["사업자등록번호", BIZ.regNo],
    ["통신판매업 신고번호", BIZ.mailOrder],
    ["주소", BIZ.address],
    ["연락처", BIZ.tel],
  ];
  const filled = rows.filter(([, v]) => !!v) as [string, string][];

  return (
    <footer className="border-t border-border bg-bg">
      <div className="mx-auto max-w-[1000px] px-5 py-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12.5px]">
          <Link href="/privacy" className="font-semibold text-muted hover:text-text">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="text-muted hover:text-text">
            이용약관
          </Link>
          <Link href="/pricing" className="text-muted hover:text-text">
            요금제
          </Link>
          <a href={`mailto:${EMAIL}`} className="text-muted hover:text-text">
            문의 {EMAIL}
          </a>
        </div>

        {filled.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] leading-relaxed text-muted">
            {filled.map(([k, v]) => (
              <span key={k}>
                {k} <span className="text-text/70">{v}</span>
              </span>
            ))}
          </div>
        )}

        <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
          Newsync는 뉴스·시세 정보와 AI 분석을 제공하며, 투자 권유가 아닙니다. 투자 판단과
          책임은 이용자 본인에게 있습니다.
        </p>
        <p className="mt-2 text-[11.5px] text-muted">
          © {new Date().getFullYear()} Newsync
        </p>
      </div>
    </footer>
  );
}
