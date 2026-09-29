"use client";

import { useId, useState } from "react";
import { buildIcs, downloadIcs } from "@/lib/ics";

/**
 * 기한을 휴대폰 캘린더에 넣는다. 날짜는 주민이 받은 통지서에 적힌 날을 직접 고르거나(또는 문서 해설이 읽은 날짜),
 * 파일은 기기 안에서 만들어져 서버로 가지 않는다.
 */
export function CalendarButton({
  title,
  description,
  initialDate,
}: {
  title: string;
  description: string;
  initialDate?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(initialDate ?? "");
  const [done, setDone] = useState(false);
  const id = useId();

  function save() {
    if (!date) return;
    downloadIcs(`${date}-재개발-기한.ics`, buildIcs({ title, dateIso: date, description }));
    setDone(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap inline-flex items-center gap-1.5 rounded-full bg-tint px-4 text-[0.85rem] font-bold text-accent"
      >
        <span aria-hidden>🗓</span> 캘린더에 알림 넣기
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-2xl border border-line bg-tint p-4">
      <label htmlFor={id} className="block text-[0.9rem] font-bold text-ink">
        통지서에 적힌 기한 날짜를 골라 주세요
      </label>
      <input
        id={id}
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          setDone(false);
        }}
        className="tap mt-2 w-full rounded-xl border border-line bg-white px-3 text-base"
      />
      <p className="mt-2 text-[0.8rem] text-ink-soft">7일 전과 하루 전 아침 9시에 알려드려요. 날짜는 휴대폰에만 저장돼요.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!date}
          className="tap flex-1 rounded-xl bg-accent font-bold text-white disabled:opacity-40"
        >
          {done ? "다시 받기" : "캘린더 파일 받기"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="tap rounded-xl px-4 font-bold text-ink-soft">
          닫기
        </button>
      </div>
      {done ? <p className="mt-2 text-[0.85rem] font-semibold text-ok">파일을 열면 캘린더에 추가돼요.</p> : null}
    </div>
  );
}
