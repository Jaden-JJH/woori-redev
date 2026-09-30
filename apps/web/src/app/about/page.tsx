import Link from "next/link";
import { Icon, IconBox, type IconName } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import type { ReactNode } from "react";

export const metadata = { title: "서비스 안내 | 우리동네 재개발 비서" };

function Block({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[18px] border border-line bg-white p-5">
      <div className="flex items-center gap-3">
        <IconBox name={icon} size={24} />
        <h2 className="text-[1.1rem] font-extrabold tracking-tight">{title}</h2>
      </div>
      <div className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col">
      <TopBar back={{ href: "/", label: "처음으로" }} />
      <div className="px-6">
        <h1 className="text-[1.5rem] leading-tight font-extrabold tracking-tight text-balance">
          답할 수 있는 것과
          <br />
          <span className="text-accent">답하지 않는 것</span>
        </h1>
      </div>
      <div className="flex flex-col gap-3.5 px-5 py-5">
        <Block icon="shield" title="이런 걸 알려드려요">
          <ul className="list-disc pl-5">
            <li>우리 구역이 정비사업 몇 단계에 있는지</li>
            <li>집주인, 세입자, 가게 세입자별로 지금 할 일과 받을 수 있는 지원</li>
            <li>분양신청, 이주, 보상 같은 절차와 기한</li>
            <li>받은 통지서와 안내문의 쉬운 말 풀이</li>
          </ul>
        </Block>
        <Block icon="hand" title="이런 건 답하지 않아요">
          <ul className="list-disc pl-5">
            <li>집값, 시세, 투자 수익 전망</li>
            <li>우리 집 분담금이 정확히 얼마인지 계산</li>
            <li>대출, 보험 같은 금융상품 추천</li>
            <li>소송 결과나 결의의 효력 같은 법적 판단</li>
          </ul>
          <p className="mt-2">공식 문서에 근거가 없으면 추측하지 않고, 확인할 수 있는 공식 창구를 알려드려요.</p>
        </Block>
        <Block icon="book" title="어디서 가져온 정보인가요">
          <ul className="list-disc pl-5">
            <li>성남시 고시공고 게시판의 정비사업 고시 (매일 자동 확인 예정)</li>
            <li>국가법령정보센터의 도시정비법, 토지보상법, 성남시 도시정비 조례 현행 조문</li>
          </ul>
          <p className="mt-2">
            모든 답변에는 근거 문서와 원문 구절을 붙여요. 이 서비스는 성남시 공개 자료를 활용한 민간 제안 서비스이며, 성남시의 공식
            서비스가 아니에요.
          </p>
        </Block>
        <Block icon="key" title="개인정보">
          <ul className="list-disc pl-5">
            <li>주소, 이름, 연락처를 묻지 않아요. 구역만 골라요.</li>
            <li>질문 내용과 올린 사진은 저장하지 않아요. 어떤 주제의 질문이 많았는지만 숫자로 집계해요.</li>
            <li>질문과 사진은 답변을 만들기 위해 AI 서비스(Anthropic, Google)로 전달돼요.</li>
            <li>글씨 크기와 마지막으로 본 구역은 이 휴대폰에만 저장돼요.</li>
          </ul>
          <Link
            href="/report"
            className="tap mt-3 inline-flex items-center gap-1.5 font-bold text-accent underline underline-offset-4"
          >
            주민들이 많이 물은 주제 보기
            <Icon name="arrow" size={16} />
          </Link>
        </Block>
        <p className="flex items-center justify-center gap-1.5 py-2 text-[0.8rem] text-ink-mute">
          <Icon name="home" size={16} /> 우리동네 재개발 비서, 팀 Trust
        </p>
      </div>
    </main>
  );
}
