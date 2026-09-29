import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IconBox, type IconName } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { api, reportStats } from "@/lib/api";
import type { ReportStats } from "@/lib/types";

// 성남시 제공용 리포트. 검색에는 노출하지 않고, 서비스 안내 페이지에서만 링크한다.
export const metadata: Metadata = {
  title: "주민 질문 리포트 | 우리동네 재개발 비서",
  robots: { index: false, follow: false },
};

const PERIODS = [
  { days: 7, label: "최근 1주" },
  { days: 30, label: "최근 1달" },
  { days: 90, label: "분기(90일)" },
];

const TOPIC_LABEL: Record<string, string> = {
  stage_status: "우리 구역 진행 단계",
  levy: "분담금",
  consent: "동의서",
  sale_application: "분양신청",
  cash_settlement: "현금청산",
  mgmt_plan: "관리처분계획",
  relocation_cost: "이주비",
  moving_cost: "이사비, 주거이전비",
  business_loss: "가게 영업손실 보상",
  deposit: "보증금 돌려받기",
  rental_housing: "임대주택",
  demolition_eviction: "이주 기한, 철거",
  title_transfer: "소유권 이전, 등기",
  settlement: "청산",
  resident_council: "조합, 총회",
  other: "기타",
};

const REFUSAL_LABEL: Record<string, string> = {
  no_evidence: "공식 문서에 근거가 없음",
  legal_judgment: "소송, 법적 판단 요청",
  price_forecast: "집값, 시세 전망 요청",
  personal_levy_calc: "우리 집 분담금 계산 요청",
  financial_product: "대출, 금융상품 추천 요청",
  evaluation: "조합, 시공사 평가 요청",
  prompt_injection: "서비스 규칙을 벗어나려는 요청",
  off_topic: "재개발과 관련 없는 질문",
  other_zone: "다른 구역에 대한 질문",
};

const RESIDENT_LABEL: Record<string, string> = {
  owner: "집주인",
  tenant: "세입자",
  shop_tenant: "가게 세입자",
};

const DOC_LABEL: Record<string, string> = {
  levy_notice: "분담금 안내문",
  sale_notice: "분양신청 안내문",
  compensation_notice: "보상 안내문",
  public_notice: "고시, 공고문",
  consent_form: "동의서",
  meeting_notice: "총회, 설명회 안내문",
  other_redevelopment: "정비사업 관련 문서",
  not_redevelopment: "관련 없는 문서",
};

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

function sumBy<T>(rows: T[], key: (r: T) => string) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + (r as { n: number }).n);
  return [...m.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-line bg-white p-5">
      <div className="flex items-center gap-3">
        <IconBox name={icon} size={22} />
        <h2 className="text-[1.1rem] font-extrabold tracking-tight">{title}</h2>
      </div>
      {hint ? <p className="mt-1.5 text-[0.8rem] leading-relaxed text-ink-mute">{hint}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** 순위 막대. 막대 길이는 1위 대비, 옆 숫자는 전체 대비 비율. */
function Bars({ rows, total, rank }: { rows: { label: string; n: number }[]; total: number; rank?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ol className="flex flex-col gap-3">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline gap-2 text-[0.92rem]">
            {rank ? <span className="w-5 shrink-0 font-extrabold text-accent">{i + 1}</span> : null}
            <span className="font-bold text-ink">{r.label}</span>
            <span className="ml-auto shrink-0 text-[0.8rem] text-ink-mute tabular-nums">
              {r.n}건, {pct(r.n, total)}%
            </span>
          </div>
          <div className={`mt-1.5 h-2.5 rounded-full bg-tint-2 ${rank ? "ml-7" : ""}`}>
            <div className="h-full rounded-full bg-accent" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-tint px-3 py-3">
      <p className="text-[0.72rem] font-bold text-ink-mute">{label}</p>
      <p className="mt-1 text-[1.35rem] leading-none font-extrabold tracking-tight text-ink tabular-nums">{value}</p>
      {sub ? <p className="mt-1 text-[0.7rem] text-ink-mute">{sub}</p> : null}
    </div>
  );
}

function Report({ s, zoneName }: { s: ReportStats; zoneName: (id: string) => string }) {
  const total = s.by_outcome.reduce((n, r) => n + r.n, 0);
  const answered = s.by_outcome.find((r) => r.outcome === "answered")?.n ?? 0;
  // '기타'는 순위에 올려도 정보가 없어 순위에서만 뺀다(비율의 분모에는 넣는다).
  const ranked = (rows: { k: string; n: number }[], k: number) =>
    rows
      .filter((t) => t.k !== "other")
      .slice(0, k)
      .map((t) => ({ label: TOPIC_LABEL[t.k] ?? t.k, n: t.n }));
  const topics = sumBy(s.by_topic, (r) => r.topic);
  const topicTotal = topics.reduce((n, r) => n + r.n, 0);
  const zones = sumBy(s.by_topic, (r) => r.zone_id);
  const refusedTotal = s.refusals.reduce((n, r) => n + r.n, 0);
  const photoTotal = s.photos.reduce((n, r) => n + r.n, 0);
  const p50 = s.latency_ms.p50;

  if (total === 0 && photoTotal === 0) {
    return (
      <p className="rounded-[18px] border border-line bg-white p-5 text-ink-soft">이 기간에는 들어온 질문이 없어요.</p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <Tile label="받은 질문" value={`${total}`} sub="건" />
        <Tile label="근거로 답변" value={`${pct(answered, total)}%`} sub={`${answered}건`} />
        <Tile label="답변 시간" value={p50 ? `${Math.round(p50 / 1000)}초` : "-"} sub="중앙값" />
      </div>

      <Section icon="chat" title="많이 물은 주제 TOP5" hint="답변을 만든 AI가 질문마다 붙인 주제를 셌어요.">
        <Bars rows={ranked(topics, 5)} total={topicTotal} rank />
      </Section>

      <Section icon="pin" title="구역별 TOP3">
        <div className="flex flex-col gap-5">
          {zones.map((z) => {
            const rows = sumBy(
              s.by_topic.filter((r) => r.zone_id === z.k),
              (r) => r.topic,
            );
            return (
              <div key={z.k}>
                <p className="mb-2 text-[0.85rem] font-extrabold text-accent">
                  {zoneName(z.k)} <span className="font-semibold text-ink-mute">{z.n}건</span>
                </p>
                <Bars rows={ranked(rows, 3)} total={z.n} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        icon="hand"
        title="답하지 않은 질문"
        hint={`전체 질문의 ${pct(refusedTotal, total)}%. '근거가 없음'이 늘면 주민에게 필요한 공식 안내가 부족하다는 신호예요.`}
      >
        {refusedTotal ? (
          <Bars
            rows={s.refusals.map((r) => ({
              label: REFUSAL_LABEL[r.reason] ?? r.reason,
              n: r.n,
            }))}
            total={refusedTotal}
          />
        ) : (
          <p className="text-[0.9rem] text-ink-soft">없어요.</p>
        )}
      </Section>

      <Section icon="person" title="누가 물었나요">
        <Bars
          rows={s.by_resident_type.map((r) => ({
            label: RESIDENT_LABEL[r.resident_type] ?? r.resident_type,
            n: r.n,
          }))}
          total={total}
        />
      </Section>

      {photoTotal ? (
        <Section icon="camera" title="사진으로 올린 문서">
          <Bars
            rows={s.photos.map((r) => ({
              label: DOC_LABEL[r.doc_type ?? ""] ?? "판독 실패",
              n: r.n,
            }))}
            total={photoTotal}
          />
        </Section>
      ) : null}
    </>
  );
}

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const q = await searchParams;
  const days = PERIODS.some((p) => String(p.days) === q.days) ? Number(q.days) : 90;
  const [stats, zones] = await Promise.all([reportStats(days), api.zones()]);
  const names = new Map(zones.map((z) => [z.id, z.name]));

  return (
    <main className="flex flex-1 flex-col">
      <TopBar back={{ href: "/", label: "처음으로" }} />
      <div className="px-6">
        <p className="text-[0.8rem] font-bold text-ink-mute">성남시 제공용 리포트 미리보기</p>
        <h1 className="mt-1 text-[1.5rem] leading-tight font-extrabold tracking-tight text-balance">
          주민들은
          <br />
          <span className="text-accent">무엇을 궁금해할까요</span>
        </h1>
        <p className="mt-2 text-[0.85rem] leading-relaxed text-ink-soft">
          질문 원문은 저장하지 않아요. 어떤 주제였는지, 답했는지만 숫자로 모았어요.
        </p>
      </div>

      <nav aria-label="집계 기간" className="mt-4 flex gap-2 px-6">
        {PERIODS.map((p) => (
          <Link
            key={p.days}
            href={`/report?days=${p.days}`}
            className={`rounded-full border px-3.5 py-2 text-[0.8rem] font-bold ${
              p.days === days ? "border-accent bg-accent text-white" : "border-line bg-white text-ink-soft"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-3.5 px-5 py-5">
        {stats ? (
          <Report s={stats} zoneName={(id) => names.get(id) ?? id} />
        ) : (
          <p className="rounded-[18px] border border-line bg-white p-5 text-ink-soft">
            운영자 설정이 없어 리포트를 볼 수 없어요. 서버의 ADMIN_TOKEN 을 확인해 주세요.
          </p>
        )}
      </div>

      {stats?.period.first ? (
        <footer className="px-6 pt-1 pb-6 text-[0.72rem] leading-relaxed text-ink-mute">
          <p>
            집계 기간 {stats.period.first} ~ {stats.period.last}. 서비스 점검과 시험 질문이 포함될 수 있어요.
          </p>
          <p>주제 분류는 AI가 붙인 것이라 일부 다를 수 있어요. 규칙으로 바로 거절한 질문은 주제 집계에서 빠져요.</p>
        </footer>
      ) : null}
    </main>
  );
}
