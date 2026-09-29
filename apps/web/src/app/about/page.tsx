import { Header } from "@/components/Header";
import { Card } from "@/components/ui";

export const metadata = { title: "서비스 안내 | 우리동네 재개발 비서" };

export default function AboutPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Header eyebrow="서비스 안내" back={{ href: "/", label: "처음으로" }} title={<>답할 수 있는 것과<br />답하지 않는 것</>} />
      <div className="flex flex-col gap-4 px-4 py-5 text-[0.98rem] leading-relaxed">
        <Card>
          <h2 className="text-lg font-extrabold">이런 걸 알려드려요</h2>
          <ul className="mt-2 list-disc pl-5 text-ink-soft">
            <li>우리 구역이 정비사업 몇 단계에 있는지</li>
            <li>집주인, 세입자, 가게 세입자별로 지금 할 일과 받을 수 있는 지원</li>
            <li>분양신청, 이주, 보상 같은 절차와 기한</li>
            <li>받은 통지서와 안내문의 쉬운 말 풀이</li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-extrabold">이런 건 답하지 않아요</h2>
          <ul className="mt-2 list-disc pl-5 text-ink-soft">
            <li>집값, 시세, 투자 수익 전망</li>
            <li>우리 집 분담금이 정확히 얼마인지 계산</li>
            <li>대출, 보험 같은 금융상품 추천</li>
            <li>소송 결과나 결의의 효력 같은 법적 판단</li>
          </ul>
          <p className="mt-2 text-ink-soft">공식 문서에 근거가 없으면 추측하지 않고, 확인할 수 있는 공식 창구를 알려드려요.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-extrabold">어디서 가져온 정보인가요</h2>
          <ul className="mt-2 list-disc pl-5 text-ink-soft">
            <li>성남시 고시공고 게시판의 정비사업 고시 (매일 확인)</li>
            <li>국가법령정보센터의 도시정비법, 토지보상법, 성남시 도시정비 조례 현행 조문</li>
          </ul>
          <p className="mt-2 text-ink-soft">
            모든 답변에는 근거 문서와 원문 구절을 붙여요. 이 서비스는 성남시 공개 자료를 활용한 민간 제안 서비스이며, 성남시의 공식
            서비스가 아니에요.
          </p>
        </Card>
        <Card>
          <h2 className="text-lg font-extrabold">개인정보</h2>
          <ul className="mt-2 list-disc pl-5 text-ink-soft">
            <li>주소, 이름, 연락처를 묻지 않아요. 구역만 골라요.</li>
            <li>질문 내용과 올린 사진은 저장하지 않아요. 어떤 주제의 질문이 많았는지만 숫자로 집계해요.</li>
            <li>질문과 사진은 답변을 만들기 위해 AI 서비스(Anthropic, Google)로 전달돼요.</li>
            <li>글씨 크기, 체크 표시, 마지막으로 본 구역은 이 휴대폰에만 저장돼요.</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
