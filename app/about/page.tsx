import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import { SOURCES } from "@/lib/sources";

// ⚠️ 이 페이지는 의도적으로 서버 컴포넌트다("use client" 금지).
// 메인 앱은 전부 클라이언트에서 그려져서 크롤러 눈에는 빈 페이지로 보인다.
// 검색엔진(특히 자바스크립트 실행이 약한 네이버 Yeti)이 실제로 읽을 수 있는
// 본문은 지금 이 페이지가 사실상 유일하다.
export const metadata: Metadata = {
  title: "Newsync 소개 — 국내외 증권 뉴스를 한 앱에서",
  description:
    "Newsync는 한국경제·연합뉴스·CNBC·Yahoo Finance 등 국내외 증권 뉴스를 한곳에 모아 보여주는 서비스입니다. 원하는 언론사만 골라 팔로우하고, 해외 기사는 한국어로 읽고, AI로 뉴스 요약과 종목 분석까지 확인하세요.",
  alternates: { canonical: "/about" },
};

const KR = SOURCES.filter((s) => !s.hidden && s.region === "kr");
const GLOBAL = SOURCES.filter((s) => !s.hidden && s.region === "global");

// 자주 묻는 질문 — 화면에도 보이고, 아래에서 같은 내용을 FAQ 구조화 데이터로
// 내보낸다(구글이 검색결과에 Q&A 리치 스니펫으로 노출할 근거).
const FAQ: { q: string; a: string }[] = [
  {
    q: "뉴싱크(Newsync)는 어떤 앱인가요?",
    a: `뉴싱크는 국내외 증권·경제 뉴스를 한곳에 모아 보여주는 무료 증권 뉴스 앱입니다. 한국경제·연합뉴스·CNBC·Yahoo Finance 등 국내 ${KR.length}개·해외 ${GLOBAL.length}개 언론사의 기사를 하나의 피드로 모아 보고, 해외 기사는 한국어로 읽으며, AI로 뉴스 요약과 종목 분석까지 확인할 수 있습니다.`,
  },
  {
    q: "증권 뉴스 앱으로 무엇을 할 수 있나요?",
    a: "관심 있는 언론사만 골라 나만의 증권 뉴스 피드를 만들고, 코스피·코스닥·나스닥 시세와 급등·급락 종목, 거래량·환율, 경제 캘린더를 확인할 수 있습니다. 기사마다 AI 요약과 관련 상장 종목 분석, 저평가·고평가 분석도 제공합니다.",
  },
  {
    q: "뉴싱크는 무료인가요?",
    a: "네, 기본 기능은 무료로 쓸 수 있는 경제 뉴스 앱입니다. AI 기능은 크레딧으로 이용하고, 프로 요금제에서는 크레딧 걱정 없이 광고 없이 무제한으로 쓸 수 있습니다.",
  },
  {
    q: "앱을 설치해야 하나요?",
    a: "설치가 필요 없습니다. 웹앱(PWA)이라 브라우저에서 바로 쓰고, 홈 화면에 추가하면 앱처럼 전체 화면으로 실행됩니다. 안드로이드·아이폰·PC 어디서나 동작하는 증권 앱입니다.",
  },
  {
    q: "해외 증시·미국 주식 뉴스도 볼 수 있나요?",
    a: "네. CNBC·Yahoo Finance·Nasdaq 등 해외 매체의 나스닥·미국 증시 뉴스를 한국어로 번역해 보여주고, 해외 종목의 시세와 차트도 앱 안에서 확인할 수 있습니다.",
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-[720px] px-5 py-10 text-text">
      <Link href="/" className="text-[13px] font-semibold text-accent">
        ← Newsync 시작하기
      </Link>

      <h1 className="mt-4 text-[26px] font-extrabold leading-snug">
        국내외 증권 뉴스를 한 앱에서, Newsync 뉴싱크
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        주식 뉴스를 보려고 앱 여러 개를 옮겨 다니는 게 번거로워서 만들었습니다.
        뉴싱크(Newsync)는 국내외 증권·경제 뉴스를 한곳에 모아 보는{" "}
        <b className="text-text">무료 증권 뉴스 앱</b>이자 경제 뉴스 앱입니다. 국내{" "}
        {KR.length}개, 해외 {GLOBAL.length}개 언론사의 증권·경제 뉴스를 한 화면에
        모아 주고, 관심 있는 언론사만 골라 팔로우하면 그 언론사들의 기사만 시간순으로
        흐르는 나만의 주식 뉴스 피드가 만들어집니다. 설치 없이 웹에서 바로 쓰는 증권
        앱으로, 코스피·코스닥·나스닥 시세와 AI 종목 분석까지 한 앱에서 봅니다.
      </p>

      <div className="mt-8 space-y-7 text-[14.5px] leading-relaxed">
        <Section title="흩어진 뉴스를 하나의 피드로">
          한국경제·연합뉴스·이데일리 같은 국내 매체와 CNBC·Yahoo Finance 같은
          해외 매체를 함께 봅니다. 상단의 언론사 칩을 누르면 사이트 이동 없이 그
          언론사 피드로 바로 전환되고, &lsquo;전체&rsquo;를 누르면 다시 통합
          피드로 돌아옵니다. 코스피·삼성전자·금리·비트코인 같은 주제 칩으로
          걸러 볼 수도 있습니다.
        </Section>

        <Section title="해외 기사도 한국어로">
          해외 기사는 제목과 요약이 한국어로 번역돼 피드에 표시됩니다. 기사를
          누르면 앱을 벗어나지 않고 본문 전체를 한국어로 읽을 수 있고, 원문이
          필요하면 리더 안에서 한/영을 바로 전환할 수 있습니다.
        </Section>

        <Section title="AI 뉴스 요약과 종목 분석">
          긴 기사는 핵심만 몇 줄로 요약해 줍니다. 관련 종목 분석을 누르면 그
          기사에서 실제로 언급되거나 영향을 받는 상장 종목을 호재·악재와 함께
          정리해 보여주고, 종목을 누르면 앱 안에서 바로 차트와 시세를 확인할 수
          있습니다. AI가 내놓는 내용은 기사 본문에 근거하도록 만들었지만, 어디까지나
          참고 정보이며 투자 권유가 아닙니다.
        </Section>

        <Section title="시장 · 급등락 · 경제 캘린더">
          코스피·코스닥·나스닥 시세와 급등·급락 종목을 확인하고, 종목을 누르면
          이동평균선을 켜고 확대하며 차트를 살펴볼 수 있습니다. 경제 캘린더에서는
          금리 결정·고용지표 같은 주요 일정을 미리 확인하고, 일정을 누르면 그게
          무엇이고 왜 중요한지 설명을 볼 수 있습니다.
        </Section>

        <Section title="같은 종목을 보는 사람들과">
          자유게시판과 그룹방에서 다른 이용자와 이야기를 나눌 수 있습니다. 직접
          뉴스를 발행할 수도 있고, 마음에 드는 이용자를 팔로우하면 그 사람의
          뉴스만 모아보는 채널이 피드 상단에 추가됩니다.
        </Section>

        <Section title="어디서나, 설치 없이">
          Newsync는 웹앱(PWA)이라 브라우저에서 바로 쓸 수 있고, 홈 화면에
          추가하면 앱처럼 전체 화면으로 실행됩니다. 로그인 없이 둘러볼 수 있으며,
          AI 기능과 커뮤니티를 이용할 때만 계정이 필요합니다.
        </Section>

        <Section title="지금 보고 있는 뉴스 소스">
          <p className="mb-2">
            국내 {KR.length}곳 · 해외 {GLOBAL.length}곳에서 뉴스를 가져옵니다.
          </p>
          <SourceList label="국내" items={KR.map((s) => s.name)} />
          <SourceList label="해외" items={GLOBAL.map((s) => s.name)} />
          <p className="mt-3 text-[13px]">
            Newsync는 각 언론사가 공개한 RSS를 통해 기사 제목과 요약을 모아
            보여주는 뉴스 리더입니다. 기사의 저작권은 각 언론사에 있으며, 원문
            보기를 통해 해당 언론사 페이지로 이동할 수 있습니다.
          </p>
        </Section>

        <Section title="요금제">
          기본 기능은 무료로 쓸 수 있습니다. AI 기능은 크레딧을 사용하며, 프로
          요금제에서는 저평가·고평가 종목, AI 종목 추천, 차트 분석, 포트폴리오
          진단 같은 기능을 추가로 이용할 수 있습니다. 자세한 내용은{" "}
          <Link href="/pricing" className="font-semibold text-accent">
            요금제 안내
          </Link>
          에서 확인하세요.
        </Section>

        <Section title="투자 정보 안내">
          Newsync가 제공하는 뉴스, 시세, AI 분석과 전망은 정보 제공 및 참고용이며
          투자 권유나 투자 자문이 아닙니다. 정보의 정확성이나 완전성을 보장하지
          않으며, 투자 판단과 그 결과에 대한 책임은 이용자 본인에게 있습니다.
        </Section>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-[18px] font-extrabold">자주 묻는 질문</h2>
        <div className="space-y-4 text-[14.5px] leading-relaxed">
          {FAQ.map((f) => (
            <div key={f.q}>
              <p className="font-bold text-text">Q. {f.q}</p>
              <p className="mt-1 text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ 구조화 데이터 (구글 리치 결과용) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      <div className="mt-10 rounded-2xl border border-border bg-bg-soft p-5 text-center">
        <p className="text-[15px] font-bold">
          관심 있는 언론사를 골라 나만의 증권 뉴스 피드를 만들어 보세요.
        </p>
        <Link
          href="/"
          className="mt-3 inline-block rounded-full bg-accent px-6 py-2.5 text-[14px] font-bold text-white"
        >
          Newsync 시작하기
        </Link>
      </div>

      <SiteFooter />
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-1.5 text-[16px] font-bold">{title}</h2>
      <div className="text-muted">{children}</div>
    </section>
  );
}

function SourceList({ label, items }: { label: string; items: string[] }) {
  return (
    <p className="mt-1.5">
      <span className="font-semibold text-text">{label}</span> · {items.join(", ")}
    </p>
  );
}
