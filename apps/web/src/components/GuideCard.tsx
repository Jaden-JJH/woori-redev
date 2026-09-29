import { KIND, highlightOf } from "@/lib/guide";
import type { ChecklistItem } from "@/lib/types";
import { CalendarButton } from "./CalendarButton";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { DISCLAIMER, lawSearchUrl } from "./ui";

/**
 * 검수된 안내 카드(점진적 공개). 제목과 조건(또는 예외)은 항상 보이고, 전체 설명은 "자세히 보기", 근거는 시트로 연다.
 * 문장은 content/*.yaml 의 검수본을 그대로 쓴다.
 */
export function GuideCard({ item, stageLabel }: { item: ChecklistItem; stageLabel?: string | null }) {
  const kind = KIND[item.kind];
  const hl = highlightOf(item);
  return (
    <article className="rounded-[18px] border border-line bg-white px-[18px] pt-[17px] pb-2">
      <div className="flex flex-wrap items-center gap-2 text-[0.83rem] font-bold text-accent">
        <Icon name={kind.icon} size={22} />
        <span>{kind.label}</span>
        {stageLabel ? <span className="font-semibold text-ink-mute">, {stageLabel}</span> : null}
      </div>
      <h3 className="mt-2.5 mb-3 text-[1.17rem] leading-snug font-bold tracking-tight text-balance">{item.title}</h3>
      {hl ? (
        <aside className="rounded-xl bg-cond px-[13px] py-3">
          <span className="mb-1 block text-[0.78rem] font-bold text-cond-label">{hl.label}</span>
          <p className="text-[1rem] leading-normal text-cond-ink">{hl.text}</p>
        </aside>
      ) : null}
      <div className="relative mt-1.5">
        <details>
          <summary className="flex min-h-12 w-[calc(100%-120px)] cursor-pointer items-center gap-2 text-[0.9rem] font-semibold text-accent">
            <span className="when-closed">자세히 보기</span>
            <span className="when-open">설명 접기</span>
            <span className="expand-icon transition-transform" aria-hidden>
              <Icon name="plus" size={16} />
            </span>
          </summary>
          <div className="border-t border-line pt-2 pb-2">
            <p className="my-2 text-[1rem] leading-relaxed text-ink-soft">{item.body}</p>
            <p className="text-[0.78rem] text-ink-mute">{item.legal_basis}</p>
          </div>
        </details>
        <div className="absolute top-0 right-0">
          <Sheet
            title={item.title}
            triggerLabel={`${item.title}, 법적 근거 보기`}
            triggerClassName="flex min-h-12 items-center gap-1.5 pl-2.5 text-[0.83rem] text-ink-source"
            trigger={
              <>
                <Icon name="book" size={17} />
                법적 근거
              </>
            }
          >
            <p className="text-[0.85rem] font-bold text-cond-label">이 안내의 근거</p>
            <p className="mt-1 text-[1.05rem] font-bold">{item.legal_basis}</p>
            <a
              href={lawSearchUrl(item.legal_basis)}
              target="_blank"
              rel="noreferrer"
              className="tap mt-2 inline-flex items-center gap-1.5 font-bold text-accent underline underline-offset-4"
            >
              국가법령정보센터에서 원문 보기 <Icon name="arrow" size={18} />
            </a>
            <p className="mt-4 text-[1rem] leading-relaxed text-ink-soft">{item.body}</p>
            {item.conditions ? (
              <p className="mt-3 rounded-xl bg-cond px-3 py-2.5 text-[0.95rem] leading-relaxed text-cond-ink">
                <b className="text-cond-label">조건 </b>
                {item.conditions}
              </p>
            ) : null}
            {item.kind === "deadline" ? (
              <div className="mt-4">
                <CalendarButton title={item.title} description={`${item.body}\n근거: ${item.legal_basis}`} />
              </div>
            ) : null}
            <p className="mt-5 text-[0.75rem] leading-relaxed text-ink-mute">{DISCLAIMER}</p>
          </Sheet>
        </div>
      </div>
    </article>
  );
}
