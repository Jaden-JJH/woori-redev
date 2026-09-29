"use client";

import Link from "next/link";
import { useState } from "react";
import { KIND, highlightOf } from "@/lib/guide";
import type { AskResult, Citation, RelatedItem, Refusal, ResidentType, Term } from "@/lib/types";
import { Icon } from "./Icon";
import { ReadAloud } from "./ReadAloud";
import { lawSearchUrl } from "./ui";

function citationHref(c: Citation): string | null {
  if (c.source_type === "law") return lawSearchUrl(c.source_label);
  return c.url;
}

function CitationList({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  const labels = Array.from(new Set(citations.map((c) => c.source_label)));
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex min-h-11 items-start gap-1.5 text-left text-[0.8rem] font-semibold text-ink-source"
      >
        <Icon name="book" size={16} className="mt-0.5" />
        <span>
          근거 {labels.join(", ")} <span className="text-accent underline underline-offset-4">{open ? "원문 접기" : "원문 보기"}</span>
        </span>
      </button>
      {open ? (
        <div className="mt-1 flex flex-col gap-2">
          {citations.map((c, i) => {
            const href = citationHref(c);
            return (
              <blockquote key={i} className="rounded-xl border-l-4 border-accent bg-cond px-4 py-3">
                <p className="text-[0.9rem] leading-relaxed text-cond-ink">&ldquo;{c.quote}&rdquo;</p>
                <p className="mt-1.5 text-[0.78rem] font-bold text-cond-label">
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      {c.source_label} 원문 열기
                    </a>
                  ) : (
                    c.source_label
                  )}
                </p>
              </blockquote>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function TermChips({ terms }: { terms: Term[] }) {
  const [active, setActive] = useState<string | null>(null);
  if (terms.length === 0) return null;
  const cur = terms.find((t) => t.term === active);
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-[0.8rem] font-bold text-ink-mute">어려운 말 풀이</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {terms.map((t) => (
          <button
            key={t.term}
            type="button"
            onClick={() => setActive(active === t.term ? null : t.term)}
            aria-expanded={active === t.term}
            className={`min-h-10 rounded-full border px-3.5 text-[0.85rem] font-semibold ${
              active === t.term ? "border-accent bg-accent text-white" : "border-line bg-white text-accent"
            }`}
          >
            {t.term}
          </button>
        ))}
      </div>
      {cur?.plain ? (
        <p className="mt-3 rounded-xl bg-paper px-4 py-3 text-[0.95rem] leading-relaxed">
          <b>{cur.term}</b>: {cur.plain}
        </p>
      ) : null}
    </div>
  );
}

function RelatedCard({ item }: { item: RelatedItem }) {
  const hl = highlightOf(item);
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3">
      <p className="flex items-center gap-1.5 text-[0.78rem] font-bold text-accent">
        <Icon name={KIND[item.kind].icon} size={17} />
        {KIND[item.kind].label}
      </p>
      <p className="mt-1 font-bold">{item.title}</p>
      {hl ? (
        <p className="mt-1.5 text-[0.9rem] leading-relaxed text-cond-ink">
          <b className="text-cond-label">{hl.label} </b>
          {hl.text}
        </p>
      ) : null}
      <p className="mt-1.5 text-[0.75rem] text-ink-mute">{item.legal_basis}</p>
    </div>
  );
}

export function AnswerCard({ result, checklistHref }: { result: AskResult; checklistHref: string }) {
  const speech = [result.summary_plain, ...result.points.map((p) => p.text)].filter(Boolean).join(" ");
  const related = result.related_items ?? [];
  return (
    <article className="mr-3 rounded-[18px] rounded-tl-md border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-ok-bg px-2.5 py-1 text-[0.78rem] font-bold text-ok">
          <Icon name="shield" size={16} /> 근거를 확인한 답변
        </span>
        <ReadAloud text={speech} />
      </div>
      {result.summary_plain ? (
        <p className="mt-3 text-[1.08rem] leading-relaxed font-bold text-balance">{result.summary_plain}</p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-3">
        {result.points.map((p, i) => (
          <li key={i} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
            <p className="text-[1rem] leading-relaxed">{p.text}</p>
            <CitationList citations={p.citations} />
          </li>
        ))}
      </ul>
      {related.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-[0.8rem] font-bold text-ink-mute">함께 확인할 검수된 안내</p>
          <div className="flex flex-col gap-2">
            {related.map((r) => (
              <RelatedCard key={r.id} item={r} />
            ))}
          </div>
        </div>
      ) : null}
      {result.next_step ? (
        <Link
          href={checklistHref}
          className="press mt-4 flex items-center justify-between gap-3 rounded-xl bg-tint px-4 py-3 text-[0.95rem] font-semibold text-accent-strong"
        >
          <span>
            <span className="block text-[0.75rem] font-bold text-accent">지금 할 수 있는 일</span>
            {result.next_step}
          </span>
          <Icon name="arrow" size={20} />
        </Link>
      ) : null}
      <TermChips terms={result.terms} />
    </article>
  );
}

export function RefusalCard({
  refusal,
  zoneName,
  residentType,
  onAsk,
}: {
  refusal: Refusal;
  zoneName: string;
  residentType: ResidentType;
  onAsk: (q: string) => void;
}) {
  return (
    <article className="rounded-[18px] border border-line bg-white p-6">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-tint text-accent" aria-hidden>
        <Icon name="hand" size={32} />
      </span>
      <h3 className="mt-3 text-center text-[1.2rem] font-extrabold text-balance">{refusal.message}</h3>
      <p className="mt-2 text-center text-[0.95rem] leading-relaxed text-ink-soft">{refusal.reason}</p>

      {refusal.switch_zone_id ? (
        <Link
          href={`/z/${refusal.switch_zone_id}/${residentType}/ask`}
          className="press mt-4 flex min-h-[54px] items-center justify-center rounded-[15px] bg-accent font-bold text-white"
        >
          구역 바꿔서 물어보기
        </Link>
      ) : null}

      {refusal.contacts.length > 0 ? (
        <div className="mt-5 rounded-xl bg-cond px-4 py-3">
          <p className="text-[0.8rem] font-bold text-cond-label">대신 확인할 수 있는 곳</p>
          <ul className="mt-2 flex flex-col gap-2">
            {refusal.contacts.map((c) => (
              <li key={c.name} className="text-[0.95rem]">
                <b>{c.name}</b>
                {c.tel ? (
                  <a href={`tel:${c.tel}`} className="tap ml-2 inline-flex items-center gap-1 font-bold text-accent underline underline-offset-4">
                    <Icon name="phone" size={16} />
                    {c.tel}
                  </a>
                ) : null}
                {c.note ? <p className="text-[0.83rem] text-cond-ink">{c.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refusal.suggestions.length > 0 ? (
        <div className="mt-5">
          <p className="text-[0.8rem] font-bold text-ink-mute">{zoneName}에 대해 이런 건 물어볼 수 있어요</p>
          <div className="mt-2 flex flex-col gap-2">
            {refusal.suggestions.slice(0, 3).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAsk(s)}
                className="press tap rounded-xl border border-line bg-paper px-4 text-left font-semibold text-ink-warm"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <article className="rounded-[18px] border border-line bg-white p-5" role="alert">
      <p className="font-bold">{message}</p>
      <button type="button" onClick={onRetry} className="press tap mt-3 rounded-xl bg-tint px-5 font-bold text-accent">
        다시 물어보기
      </button>
    </article>
  );
}
