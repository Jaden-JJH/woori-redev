"use client";

import { useEffect, useRef, useState } from "react";
import { AnswerCard, ErrorCard, RefusalCard } from "@/components/AnswerCards";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/format";
import type { AskResult, ResidentType } from "@/lib/types";

type Step = "analyze" | "retrieve" | "generate" | "verify";
const STEPS: { id: Step; label: string }[] = [
  { id: "analyze", label: "질문 이해" },
  { id: "retrieve", label: "우리 구역 공식 문서 찾기" },
  { id: "verify", label: "근거 확인" },
];

interface Turn {
  id: number;
  question: string;
  step: Step | null;
  result: AskResult | null;
  error: string | null;
}

async function askStream(
  body: { zone_id: string; resident_type: ResidentType; question: string },
  onStep: (s: Step) => void,
): Promise<AskResult> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error?.message ?? "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.");
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const event = raw.match(/^event: (.+)$/m)?.[1];
      const data = raw.match(/^data: (.+)$/m)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === "progress") onStep(payload.step);
      if (event === "result") return payload as AskResult;
      if (event === "error") throw new Error(payload.message);
    }
  }
  throw new Error("답변을 받지 못했어요. 다시 시도해 주세요.");
}

export function AskClient({
  zoneId,
  zoneName,
  residentType,
  suggestions,
  asOf,
}: {
  zoneId: string;
  zoneName: string;
  residentType: ResidentType;
  suggestions: string[];
  asOf: string;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function send(question: string) {
    const q = question.trim();
    if (q.length < 2 || busy) return;
    const id = nextId.current++;
    setTurns((t) => [...t, { id, question: q, step: "analyze", result: null, error: null }]);
    setInput("");
    setBusy(true);
    const update = (patch: Partial<Turn>) => setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try {
      const result = await askStream({ zone_id: zoneId, resident_type: residentType, question: q }, (step) =>
        update({ step }),
      );
      update({ result, step: null });
    } catch (e) {
      update({ error: e instanceof Error ? e.message : "잠시 문제가 생겼어요.", step: null });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-1 flex-col gap-4 px-5 py-5" aria-live="polite">
        {turns.length === 0 ? (
          <div className="rounded-[18px] border border-line bg-white p-5">
            <p className="font-bold">이렇게 물어볼 수 있어요</p>
            <div className="mt-3 flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="press tap flex items-center justify-between gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-left font-semibold text-ink-warm"
                >
                  {s}
                  <Icon name="arrow" size={18} className="text-accent" />
                </button>
              ))}
            </div>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-cond px-3 py-2.5 text-[0.83rem] leading-relaxed text-cond-ink">
              <Icon name="hand" size={18} className="mt-0.5 text-cond-label" />
              집값 전망, 우리 집 분담금 계산, 대출 추천, 법적 판단은 답하지 않아요. 공식 문서에 근거가 있는 내용만 알려드려요.
            </p>
          </div>
        ) : null}

        {turns.map((t) => (
          <div key={t.id} className="flex flex-col gap-3">
            <p className="ml-10 self-end rounded-[18px] rounded-br-md bg-accent px-5 py-3.5 text-[1rem] font-semibold text-white">
              {t.question}
            </p>
            {t.step ? <Progress step={t.step} /> : null}
            {t.result?.outcome === "answered" ? (
              <AnswerCard result={t.result} checklistHref={`/z/${zoneId}/${residentType}/checklist`} />
            ) : null}
            {t.result && t.result.outcome !== "answered" && t.result.refusal ? (
              <RefusalCard refusal={t.result.refusal} zoneName={zoneName} onAsk={send} residentType={residentType} />
            ) : null}
            {t.result?.outcome === "error" || t.error ? (
              <ErrorCard message={t.error ?? "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요."} onRetry={() => send(t.question)} />
            ) : null}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-[72px] z-10 border-t border-line bg-paper px-4 py-3"
      >
        <p className="mb-2 px-1 text-[0.7rem] text-ink-mute">
          AI가 공식 문서를 근거로 만든 안내예요. 질문 내용은 저장하지 않아요. 기준일 {formatDate(asOf)}
        </p>
        <div className="flex gap-2">
          <label htmlFor="q" className="sr-only">
            질문
          </label>
          <input
            id="q"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={300}
            placeholder="궁금한 점을 적어 주세요"
            className="tap min-w-0 flex-1 rounded-[15px] border border-line bg-white px-4 text-base"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || input.trim().length < 2}
            className="press tap rounded-[15px] bg-accent px-5 font-bold text-white disabled:opacity-40"
          >
            묻기
          </button>
        </div>
      </form>
    </>
  );
}

function Progress({ step }: { step: Step }) {
  const order: Step[] = ["analyze", "retrieve", "generate", "verify"];
  const cur = order.indexOf(step);
  return (
    <div className="rounded-[18px] border border-line bg-white p-5" role="status">
      <ol className="flex flex-col gap-3">
        {STEPS.map((s) => {
          const idx = order.indexOf(s.id);
          const state =
            idx < cur || (s.id === "retrieve" && step === "generate")
              ? "done"
              : idx === cur || (s.id === "verify" && step === "generate")
                ? "now"
                : "todo";
          return (
            <li key={s.id} className="flex items-center gap-3">
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-[0.8rem] font-bold ${
                  state === "done" ? "bg-accent text-white" : state === "now" ? "pulse-soft bg-peach text-accent" : "bg-tint-2 text-ink-mute"
                }`}
              >
                {state === "done" ? "✓" : ""}
              </span>
              <span className={`font-semibold ${state === "todo" ? "text-ink-mute" : "text-ink"}`}>{s.label}</span>
              <span className="sr-only">{state === "done" ? "완료" : state === "now" ? "진행 중" : "대기"}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
