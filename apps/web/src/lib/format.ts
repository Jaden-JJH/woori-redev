const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00+09:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}(${WEEK[d.getDay()]})`;
}

export function daysFromToday(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${iso}T00:00:00`);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

export function relativeDays(iso: string): string {
  const n = daysFromToday(iso);
  if (n === 0) return "오늘";
  if (n > 0) return `${n}일 남았어요`;
  return `${-n}일 지났어요`;
}

/** 문서에 적힌 날짜 표현(2026. 10. 30., 2026-10-30, 2026년 10월 30일)을 ISO 로 바꾼다. 못 읽으면 null. */
export function parseKoreanDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/(20\d{2})\s*(?:[.\-/]|년)\s*(\d{1,2})\s*(?:[.\-/]|월)\s*(\d{1,2})/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
