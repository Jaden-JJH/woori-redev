/**
 * 기한 알림: 휴대폰 기본 캘린더에 넣을 .ics 파일을 브라우저에서 만든다.
 * 서버로 아무것도 보내지 않으므로 개인정보 없이 알림을 쓸 수 있다.
 */

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(opts: { title: string; dateIso: string; description: string; url?: string }): string {
  const day = opts.dateIso.replace(/-/g, "");
  const next = new Date(`${opts.dateIso}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dayEnd = next.toISOString().slice(0, 10).replace(/-/g, "");
  const uid = `${day}-${Math.random().toString(36).slice(2)}@woori-redev`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//woori-redev//ko",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${dayEnd}`,
    `SUMMARY:${esc(opts.title)}`,
    `DESCRIPTION:${esc(opts.description)}`,
    ...(opts.url ? [`URL:${opts.url}`] : []),
    // 7일 전, 1일 전 아침 9시에 알림
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(opts.title)} 7일 전이에요`,
    "TRIGGER:-P6DT15H",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(opts.title)} 하루 전이에요`,
    "TRIGGER:-PT15H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
