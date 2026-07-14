import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 — Newsync",
  description: "Newsync 개인정보처리방침",
};

const UPDATED = "2026년 7월 14일";
const CONTACT = "skylee993393@gmail.com"; // ⚠️ 운영자 문의 이메일 — 원하면 변경하세요

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-10 text-text">
      <Link href="/" className="text-[13px] font-semibold text-accent">
        ← Newsync로 돌아가기
      </Link>
      <h1 className="mt-4 text-[26px] font-extrabold">개인정보처리방침</h1>
      <p className="mt-1 text-[13px] text-muted">최종 업데이트: {UPDATED}</p>

      <div className="mt-6 space-y-6 text-[14.5px] leading-relaxed">
        <p>
          Newsync(이하 &ldquo;서비스&rdquo;)는 이용자의 개인정보를 중요하게
          생각하며, 아래와 같이 수집·이용·보관합니다. 서비스를 이용하시면 본
          방침에 동의하는 것으로 간주됩니다.
        </p>

        <Section title="1. 수집하는 정보">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>계정 정보</b>: 이메일 주소, 아이디(닉네임), 비밀번호(단방향
              암호화되어 저장되며 원문은 보관하지 않습니다).
            </li>
            <li>
              <b>프로필</b>: 프로필 사진, 대표 색상, 소개글(설정한 경우).
            </li>
            <li>
              <b>이용자 생성 콘텐츠</b>: 작성한 뉴스·게시글·댓글, 그룹방 메시지,
              업로드한 이미지, 좋아요·팔로우 기록.
            </li>
            <li>
              <b>기기 저장 설정</b>: 팔로우한 소스, 관심 종목·키워드, 테마(라이트/
              다크) 등은 기기의 로컬 저장소(localStorage)에만 저장되며 서버로
              전송되지 않습니다.
            </li>
          </ul>
        </Section>

        <Section title="2. 이용 목적">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>회원 가입·로그인 및 계정 관리</li>
            <li>뉴스 피드, 커뮤니티(게시판·그룹방), 프로필 등 서비스 제공</li>
            <li>AI 뉴스 요약·종목 분석·대화 기능 제공</li>
            <li>서비스 운영·개선 및 부정 이용 방지</li>
          </ul>
        </Section>

        <Section title="3. 제3자 서비스로의 처리 위탁">
          서비스 제공을 위해 아래 외부 서비스를 이용하며, 필요한 범위의 정보만
          전달됩니다.
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <b>Supabase</b> — 데이터베이스 및 이미지 저장
            </li>
            <li>
              <b>Vercel</b> — 서비스 호스팅
            </li>
            <li>
              <b>Google Gemini</b> — AI 요약·분석·대화 (해당 기능 사용 시 기사
              본문이나 입력한 질문이 전송됩니다)
            </li>
            <li>
              <b>네이버 금융</b> — 주식 시세·차트 조회
            </li>
            <li>
              <b>Google 뉴스·번역</b> — 뉴스 수집 및 한국어 번역
            </li>
          </ul>
        </Section>

        <Section title="4. 정보의 공개">
          작성한 게시글·댓글·그룹방 메시지·프로필(닉네임·사진 등)은 다른
          이용자에게 공개됩니다. 이메일과 비밀번호는 다른 이용자에게 공개되지
          않습니다. 서비스 운영자(관리자)는 운영 목적으로 가입자 목록(닉네임·
          이메일·가입일)을 확인할 수 있습니다.
        </Section>

        <Section title="5. 보관 및 삭제">
          정보는 계정이 유지되는 동안 보관됩니다. 계정 및 데이터 삭제를 원하시면
          아래 문의처로 요청해 주세요. 요청 시 계정과 관련 데이터를 삭제합니다.
        </Section>

        <Section title="6. 광고·판매">
          Newsync는 이용자의 개인정보를 제3자에게 판매하지 않으며, 광고 목적의
          정보 제공을 하지 않습니다.
        </Section>

        <Section title="7. 투자 정보 관련 유의">
          서비스가 제공하는 AI 종목 분석·주가 전망 등은 참고용 정보이며 투자
          권유가 아닙니다. 모든 투자 판단과 그 결과에 대한 책임은 이용자 본인에게
          있습니다.
        </Section>

        <Section title="8. 문의">
          개인정보 관련 문의: <a className="text-accent" href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </Section>
      </div>

      <div className="mt-10 border-t border-border pt-4 text-[13px] text-muted">
        <Link href="/terms" className="text-accent">
          이용약관 보기
        </Link>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 text-[16px] font-bold">{title}</h2>
      <div className="text-muted">{children}</div>
    </section>
  );
}
