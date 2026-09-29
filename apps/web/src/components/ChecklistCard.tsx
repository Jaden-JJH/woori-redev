"use client";

import { useLocal, writeLocal } from "@/lib/local";
import type { ChecklistItem } from "@/lib/types";
import { CalendarButton } from "./CalendarButton";
import { SourceBadge, lawSearchUrl } from "./ui";

const KIND_STYLE: Record<ChecklistItem["kind"], { label: string; cls: string }> = {
  todo: { label: "할 일", cls: "bg-navy-50 text-navy-700" },
  deadline: { label: "기한", cls: "bg-orange-accent text-white" },
  benefit: { label: "받을 수 있어요", cls: "bg-ok-bg text-ok" },
  caution: { label: "꼭 알아두세요", cls: "bg-cream text-orange-accent" },
};

/** 체크 표시는 이 기기에만 저장한다. */
function useChecked(id: string) {
  const key = `woori.check.${id}`;
  const checked = useLocal(key) === "1";
  function toggle() {
    writeLocal(key, checked ? "0" : "1");
  }
  return [checked, toggle] as const;
}

export function ChecklistCard({ item, showStage = false }: { item: ChecklistItem; showStage?: boolean }) {
  const [checked, toggle] = useChecked(item.id);
  const kind = KIND_STYLE[item.kind];
  const checkable = item.kind === "todo" || item.kind === "deadline";
  return (
    <article className="rounded-3xl bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)]">
      <div className="flex items-start gap-3">
        {checkable ? (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={checked}
            aria-label={checked ? "완료 표시 지우기" : "완료로 표시"}
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${
              checked ? "border-navy-700 bg-navy-700 text-white" : "border-navy-100 bg-white"
            }`}
          >
            {checked ? "✓" : ""}
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold ${kind.cls}`}>{kind.label}</span>
            {item.is_money ? (
              <span className="rounded-full bg-amber-accent/25 px-2.5 py-0.5 text-[0.75rem] font-bold text-navy-900">돈</span>
            ) : null}
            {showStage && item.stage ? (
              <span className="text-[0.8rem] font-semibold text-ink-mute">{item.stage.name} 때</span>
            ) : null}
          </div>
          <h3 className={`mt-2 text-[1.1rem] leading-snug font-extrabold ${checked ? "text-ink-mute line-through" : "text-ink"}`}>
            {item.title}
          </h3>
          <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-soft">{item.body}</p>
          {item.conditions ? (
            <p className="mt-2 rounded-2xl bg-paper px-3 py-2 text-[0.88rem] leading-relaxed text-ink-soft">
              <b className="text-ink">조건 </b>
              {item.conditions}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SourceBadge label={item.legal_basis} href={lawSearchUrl(item.legal_basis)} />
          </div>
          {item.kind === "deadline" ? (
            <div className="mt-3">
              <CalendarButton title={item.title} description={`${item.body}\n근거: ${item.legal_basis}`} />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
