import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-tint px-2.5 py-1.5 text-[0.78rem] font-bold text-accent">
      {children}
    </span>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-[1.15rem] font-extrabold tracking-tight text-ink">{children}</h2>
      {hint ? <span className="text-[0.8rem] text-ink-mute">{hint}</span> : null}
    </div>
  );
}

/** 법령, 고시 근거 링크. */
export function SourceLink({ label, href }: { label: string; href?: string | null }) {
  const inner = (
    <>
      <Icon name="book" size={15} className="mt-0.5" />
      <span>{label}</span>
    </>
  );
  const cls = "inline-flex items-start gap-1.5 text-left text-[0.8rem] font-semibold text-ink-mute";
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} underline underline-offset-4`}>
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

export function lawSearchUrl(ref: string): string {
  // "도시정비법 제72조제1항, 제2항" -> 국가법령정보센터 해당 법령 페이지
  const law = ref
    .split(",")[0]
    .replace(/\s*제\d.*$/, "")
    .replace(/\s*별표.*$/, "")
    .trim();
  const full: Record<string, string> = {
    도시정비법: "도시및주거환경정비법",
    "도시정비법 시행령": "도시및주거환경정비법시행령",
    "도시정비법 시행규칙": "도시및주거환경정비법시행규칙",
    토지보상법: "공익사업을위한토지등의취득및보상에관한법률",
    "토지보상법 시행령": "공익사업을위한토지등의취득및보상에관한법률시행령",
    "토지보상법 시행규칙": "공익사업을위한토지등의취득및보상에관한법률시행규칙",
  };
  if (law.startsWith("성남시")) return "https://www.law.go.kr/자치법규/성남시도시및주거환경정비에관한조례";
  return `https://www.law.go.kr/법령/${full[law] ?? law.replace(/\s/g, "")}`;
}

export const DISCLAIMER =
  "이 안내는 법률, 투자 자문이 아니에요. 효력은 원문 고시와 법령에 있어요. 최종 확인은 조합, 사업시행자, 성남시에 해 주세요.";

export function Footnote({ asOf, children }: { asOf: string; children?: ReactNode }) {
  return (
    <footer className="px-6 pt-2 pb-6 text-[0.72rem] leading-relaxed text-ink-mute">
      {children}
      <p>데이터 기준일 {asOf}</p>
      <p>{DISCLAIMER}</p>
    </footer>
  );
}
