"use client";

import Link from "next/link";
import { useState } from "react";
import type { AskResult, Citation, Refusal, ResidentType, Term } from "@/lib/types";
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
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-navy-50 px-2.5 text-[0.8rem] font-semibold text-navy-700"
      >
        근거 <span className="text-ink-soft">{labels.join(", ")}</span>
        <span aria-hidden>{open ? "▲" : "▼"}</span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          {citations.map((c, i) => {
            const href = citationHref(c);
            return (
              <blockquote key={i} className="rounded-2xl border-l-4 border-navy-700 bg-navy-50 px-4 py-3">
                <p className="text-[0.9rem] leading-relaxed text-ink">&ldquo;{c.quote}&rdquo;</p>
                <p className="mt-1.5 text-[0.8rem] font-semibold text-navy-700">
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer" className="underline">
                      {c.source_label} 원문 보기
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
    <div className="mt-4 border-t border-navy-50 pt-4">
      <p className="text-[0.85rem] font-bold text-ink-soft">어려운 말 풀이</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {terms.map((t) => (
          <button
            key={t.term}
            type="button"
            onClick={() => setActive(active === t.term ? null : t.term)}
            aria-expanded={active === t.term}
            className={`min-h-[40px] rounded-full border px-3.5 text-[0.9rem] font-semibold ${
              active === t.term ? "border-navy-700 bg-navy-700 text-white" : "border-navy-100 text-navy-700"
            }`}
          >
            {t.term}
          </button>
        ))}
      </div>
      {cur?.plain ? (
        <p className="mt-3 rounded-2xl bg-paper px-4 py-3 text-[0.95rem] leading-relaxed text-ink">
          <b>{cur.term}</b>: {cur.plain}
        </p>
      ) : null}
    </div>
  );
}

export function AnswerCard({ result }: { result: AskResult }) {
  const speech = [result.summary_plain, ...result.points.map((p) => p.text), result.next_step].filter(Boolean).join(" ");
  return (
    <article className="mr-4 rounded-3xl rounded-tl-md bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-ok-bg px-3 py-1 text-[0.8rem] font-bold text-ok">✓ 근거 확인된 답변</span>
        <ReadAloud text={speech} />
      </div>
      {result.summary_plain ? (
        <p className="mt-3 text-[1.1rem] leading-relaxed font-bold text-ink">{result.summary_plain}</p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-4">
        {result.points.map((p, i) => (
          <li key={i}>
            <p className="text-[1rem] leading-relaxed text-ink">{p.text}</p>
            <CitationList citations={p.citations} />
          </li>
        ))}
      </ul>
      {result.next_step ? (
        <div className="mt-4 rounded-2xl bg-cream px-4 py-3">
          <p className="text-[0.85rem] font-bold text-orange-accent">지금 할 수 있는 일</p>
          <p className="mt-1 text-[0.98rem] leading-relaxed text-ink">{result.next_step}</p>
        </div>
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
    <article className="rounded-3xl bg-white p-6 text-center shadow-[0_2px_10px_rgba(21,40,79,0.06)]">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream text-3xl" aria-hidden>
        ✋
      </span>
      <h3 className="mt-3 text-xl font-extrabold text-ink">{refusal.message}</h3>
      <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-soft">{refusal.reason}</p>

      {refusal.switch_zone_id ? (
        <Link
          href={`/z/${refusal.switch_zone_id}/${residentType}/ask`}
          className="tap mt-4 flex items-center justify-center rounded-2xl bg-navy-700 font-bold text-white"
        >
          구역 바꿔서 물어보기
        </Link>
      ) : null}

      {refusal.contacts.length > 0 ? (
        <div className="mt-5 rounded-2xl border-l-4 border-navy-700 bg-navy-50 px-4 py-3 text-left">
          <p className="text-[0.9rem] font-bold text-navy-700">대신 확인할 수 있는 곳</p>
          <ul className="mt-2 flex flex-col gap-2">
            {refusal.contacts.map((c) => (
              <li key={c.name} className="text-[0.95rem] text-ink">
                <b>{c.name}</b>
                {c.tel ? (
                  <a href={`tel:${c.tel}`} className="ml-2 font-bold text-navy-700 underline">
                    {c.tel}
                  </a>
                ) : null}
                {c.note ? <p className="text-[0.85rem] text-ink-soft">{c.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refusal.suggestions.length > 0 ? (
        <div className="mt-5 text-left">
          <p className="text-[0.9rem] font-bold text-ink-soft">{zoneName}에 대해 이런 건 물어볼 수 있어요</p>
          <div className="mt-2 flex flex-col gap-2">
            {refusal.suggestions.slice(0, 3).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAsk(s)}
                className="tap rounded-2xl border border-navy-100 px-4 text-left font-semibold text-navy-800"
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
    <article className="rounded-3xl bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)]">
      <p className="font-bold text-ink">{message}</p>
      <button type="button" onClick={onRetry} className="tap mt-3 rounded-2xl bg-navy-50 px-5 font-bold text-navy-700">
        다시 물어보기
      </button>
    </article>
  );
}
