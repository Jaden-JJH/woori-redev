import type { IconName } from "@/components/Icon";
import type { ChecklistItem } from "./types";

/** "이주, 철거, 착공" -> "이주 단계", "정비구역 지정" -> "정비구역 지정 단계" */
export function stageShort(name: string): string {
  return `${name.split(",")[0].trim()} 단계`;
}

export const KIND: Record<ChecklistItem["kind"], { label: string; icon: IconName }> = {
  caution: { label: "먼저 확인", icon: "alert" },
  deadline: { label: "기한 확인", icon: "clock" },
  benefit: { label: "받을 수 있는 지원", icon: "gift" },
  todo: { label: "해야 할 일", icon: "list" },
};

/**
 * 항상 보여줄 조건 상자. 검수된 문장을 바꾸지 않고 그대로 가져온다.
 * 1) conditions 필드가 있으면 그것, 2) 없으면 본문에서 "다만" 으로 시작하는 예외 문장.
 */
export function highlightOf(item: Pick<ChecklistItem, "kind" | "body" | "conditions">): { label: string; text: string } | null {
  if (item.conditions) return { label: item.kind === "benefit" ? "지원 조건" : "해당 조건", text: item.conditions };
  const sentences = item.body.match(/[^.!?]+[.!?]/g) ?? [];
  const exception = sentences.map((s) => s.trim()).find((s) => s.startsWith("다만"));
  return exception ? { label: "예외 확인", text: exception } : null;
}

/** 지금 가장 먼저 보여줄 안내 하나. 주의, 기한, 지원, 할 일 순. */
export function topItem(now: { todo: ChecklistItem[]; benefit: ChecklistItem[]; caution: ChecklistItem[] }): ChecklistItem | null {
  return (
    now.caution[0] ?? now.todo.find((i) => i.kind === "deadline") ?? now.benefit[0] ?? now.todo[0] ?? null
  );
}
