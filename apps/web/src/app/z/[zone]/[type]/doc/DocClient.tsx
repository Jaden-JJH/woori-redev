"use client";

import { useRef, useState } from "react";
import { ErrorCard } from "@/components/AnswerCards";
import { CalendarButton } from "@/components/CalendarButton";
import { ReadAloud } from "@/components/ReadAloud";
import { SourceBadge, lawSearchUrl } from "@/components/ui";
import { parseKoreanDate } from "@/lib/format";
import type { ExplainResult, ResidentType } from "@/lib/types";

/** 긴 변 2000px 로 줄이고 JPEG 로 다시 그린다. 이 과정에서 위치 정보(EXIF)가 사라진다. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("사진을 읽지 못했어요."))), "image/jpeg", 0.88),
  );
}

export function DocClient({ zoneId, residentType }: { zoneId: string; residentType: ResidentType }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  async function upload(file: File) {
    setLastFile(file);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const blob = await shrink(file);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      const form = new FormData();
      form.append("image", blob, "document.jpg");
      form.append("zone_id", zoneId);
      form.append("resident_type", residentType);
      const res = await fetch("/api/explain", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "잠시 문제가 생겼어요.");
      if (data.outcome === "error") throw new Error("잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "잠시 문제가 생겼어요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <div className="rounded-3xl bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)]">
        <p className="font-bold text-ink">통지서, 안내문, 공고문 사진을 올려 주세요</p>
        <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-soft">
          세 줄로 요약하고 어려운 말을 풀어드려요. 사진은 해설에만 쓰고 저장하지 않아요. 이름, 주민등록번호가 보이면 가리고 찍으셔도
          돼요.
        </p>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-navy-700 py-4 text-lg font-bold text-white disabled:opacity-50"
        >
          📷 {preview ? "다른 사진 올리기" : "사진 찍기 또는 고르기"}
        </button>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="올린 문서 사진" className="mt-4 max-h-64 w-full rounded-2xl object-contain bg-paper" />
        ) : null}
      </div>

      {busy ? (
        <div className="rounded-3xl bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)]" role="status">
          <p className="pulse-soft font-bold text-ink">문서를 읽고 있어요. 잠시만 기다려 주세요.</p>
        </div>
      ) : null}

      {error ? <ErrorCard message={error} onRetry={() => lastFile && upload(lastFile)} /> : null}

      {result?.outcome === "refused_policy" && result.refusal ? (
        <div className="rounded-3xl bg-white p-5 text-center shadow-[0_2px_10px_rgba(21,40,79,0.06)]">
          <p className="text-3xl" aria-hidden>
            ✋
          </p>
          <p className="mt-2 text-lg font-extrabold">{result.refusal.message}</p>
        </div>
      ) : null}

      {result?.outcome === "explained" ? <ExplainView r={result} /> : null}
    </div>
  );
}

function ExplainView({ r }: { r: ExplainResult }) {
  const speech = [r.doc_type_label, ...(r.summary_lines ?? [])].join(". ");
  return (
    <article className="rounded-3xl bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-navy-50 px-3 py-1 text-[0.8rem] font-bold text-navy-700">{r.doc_type_label}</span>
        <ReadAloud text={speech} />
      </div>
      {r.title_in_doc ? <h3 className="mt-3 text-lg font-extrabold text-ink">{r.title_in_doc}</h3> : null}
      {r.issuer ? <p className="text-[0.85rem] text-ink-mute">보낸 곳: {r.issuer}</p> : null}

      <p className="mt-4 text-[0.85rem] font-bold text-ink-soft">세 줄 요약</p>
      <ol className="mt-2 flex flex-col gap-2">
        {r.summary_lines?.map((line, i) => (
          <li key={i} className="flex gap-2 text-[1rem] leading-relaxed text-ink">
            <span className="font-extrabold text-navy-700">{i + 1}</span>
            {line}
          </li>
        ))}
      </ol>

      {r.cautions?.map((c) => (
        <div key={c.title} className="mt-4 rounded-2xl bg-cream px-4 py-3">
          <p className="font-bold text-orange-accent">{c.title}</p>
          <p className="mt-1 text-[0.95rem] leading-relaxed text-ink">{c.body}</p>
          <div className="mt-2">
            <SourceBadge label={c.legal_basis} href={lawSearchUrl(c.legal_basis)} />
          </div>
        </div>
      ))}

      {r.actions && r.actions.length > 0 ? (
        <div className="mt-4">
          <p className="text-[0.85rem] font-bold text-ink-soft">문서가 요구하는 일</p>
          <ul className="mt-2 flex flex-col gap-3">
            {r.actions.map((a, i) => (
              <li key={i} className="rounded-2xl bg-paper px-4 py-3">
                <p className="font-semibold text-ink">{a.what}</p>
                {a.deadline_in_doc ? <p className="mt-1 text-[0.9rem] font-bold text-orange-accent">기한: {a.deadline_in_doc}</p> : null}
                {a.deadline_in_doc ? (
                  <div className="mt-2">
                    <CalendarButton
                      title={a.what}
                      description={`${r.title_in_doc ?? r.doc_type_label}\n문서에 적힌 기한: ${a.deadline_in_doc}`}
                      initialDate={parseKoreanDate(a.deadline_in_doc)}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.amounts_in_doc && r.amounts_in_doc.length > 0 ? (
        <div className="mt-4">
          <p className="text-[0.85rem] font-bold text-ink-soft">문서에 적힌 금액</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {r.amounts_in_doc.map((m, i) => (
              <li key={i} className="flex justify-between gap-3 text-[0.95rem]">
                <span className="text-ink-soft">{m.label}</span>
                <b className="text-ink">{m.amount_text}</b>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.8rem] text-ink-mute">금액은 문서에 적힌 그대로 옮겼어요. 금액이 맞는지, 많은지는 판단하지 않아요.</p>
        </div>
      ) : null}

      {r.terms && r.terms.length > 0 ? (
        <div className="mt-4 border-t border-navy-50 pt-4">
          <p className="text-[0.85rem] font-bold text-ink-soft">어려운 말 풀이</p>
          <dl className="mt-2 flex flex-col gap-2">
            {r.terms.map((t) => (
              <div key={t.term} className="rounded-2xl bg-paper px-4 py-3">
                <dt className="font-bold text-ink">{t.term}</dt>
                {t.plain ? <dd className="mt-0.5 text-[0.95rem] leading-relaxed text-ink-soft">{t.plain}</dd> : null}
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {r.related_citations && r.related_citations.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {r.related_citations.map((c) => (
            <SourceBadge key={c.source_label} label={c.source_label} href={lawSearchUrl(c.source_label)} />
          ))}
        </div>
      ) : null}

      {r.unreadable ? <p className="mt-3 text-[0.85rem] text-ink-mute">잘 안 보인 부분: {r.unreadable}</p> : null}
      <p className="mt-4 text-[0.75rem] text-ink-mute">AI가 사진 속 글을 읽고 만든 해설이에요. 중요한 내용은 원본 문서로 꼭 다시 확인하세요.</p>
    </article>
  );
}
