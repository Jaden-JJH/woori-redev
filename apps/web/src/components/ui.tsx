import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)] ${className}`}>{children}</section>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h2 className="text-lg font-extrabold text-ink">{children}</h2>
      {hint ? <span className="text-sm text-ink-mute">{hint}</span> : null}
    </div>
  );
}

/** 법령, 고시 근거 표시. 모든 안내 문장 옆에 붙는다. */
export function SourceBadge({ label, href }: { label: string; href?: string | null }) {
  const cls =
    "inline-flex items-start gap-1.5 rounded-lg text-left bg-navy-50 px-2.5 py-1 text-[0.8rem] font-semibold text-navy-700";
  const inner = (
    <>
      <span className="shrink-0">근거</span>
      <span className="text-ink-soft">{label}</span>
    </>
  );
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={`${cls} underline-offset-2 hover:underline`}>
      {inner}
    </a>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

export function lawSearchUrl(ref: string): string {
  // "도시정비법 제72조제1항" -> 국가법령정보센터 검색
  const law = ref.replace(/\s*제\d.*$/, "").replace(/\s*별표.*$/, "");
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

export function Footnote({ asOf }: { asOf: string }) {
  return (
    <p className="px-5 py-4 text-[0.8rem] leading-relaxed text-ink-mute">
      <b className="text-ink-soft">이 안내는 법률, 투자 자문이 아니에요.</b> 효력은 원문 고시와 법령에 있어요. 최종 확인은 조합,
      사업시행자, 성남시에 해 주세요. 데이터 기준일 {asOf}
    </p>
  );
}
