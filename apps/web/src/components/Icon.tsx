/** 선 아이콘. 경로는 design/ui-concepts 시안과 같다. */
const PATHS = {
  home: "M3 10 12 3l9 7v10H3V10Z M9 20v-7h6v7",
  check: "M8 4H5v17h14V4h-3 M9 3h6v4H9z M8 13l3 3 5-6",
  money: "M4 7h16v13H4z M7 4v5m10-5v5 M4 11h16 M9 16h6",
  chat: "M4 4h16v13H9l-5 4V4Z M8 10h8",
  doc: "M7 3h8l4 4v14H5V3h2 M14 3v5h5 M8 12h8m-8 4h6",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  pin: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z M12 7v5",
  back: "m14 5-7 7 7 7",
  box: "m3 7 9-4 9 4v12l-9 3-9-3V7Z M3 7l9 4 9-4 M12 11v11 M7 5l10 4",
  book: "M4 4h6l2 2 2-2h6v16h-6l-2 2-2-2H4V4Z M12 6v16",
  alert: "M12 3 2 20h20L12 3Z M12 10v4 M12 17v.5",
  gift: "M4 10h16v10H4z M3 7h18v3H3z M12 7v13 M12 7c-2-4-6-3-5 0 M12 7c2-4 6-3 5 0",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7v5l3 2",
  list: "M9 6h11 M9 12h11 M9 18h11 M4 6h.5 M4 12h.5 M4 18h.5",
  shop: "M4 10v10h16V10 M3 4h18l-1 6H4L3 4Z M9 20v-5h6v5",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21c1-4 4-6 8-6s7 2 8 6",
  key: "M14 10a4 4 0 1 0-4 4 M10 14l-6 6 M7 17l2 2 M13 10h7v3",
  camera: "M4 8h3l2-3h6l2 3h3v11H4V8Z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z",
  phone: "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2Z",
  shield: "M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z M9 12l2 2 4-4",
  hand: "M8 13V6a1.5 1.5 0 0 1 3 0v5 M11 11V4.5a1.5 1.5 0 0 1 3 0V11 M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-3 8-7 8-3 0-5-2-6-4l-2-4a1.5 1.5 0 0 1 2.5-1.5L8 13",
  close: "M6 6l12 12M18 6 6 18",
  speaker: "M4 9h4l5-4v14l-5-4H4V9Z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11",
  stop: "M7 7h10v10H7z",
  calendar: "M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5",
  chevron: "m6 9 6 6 6-6",
  plus: "M12 5v14 M5 12h14",
  share: "M12 15V3 M7 8l5-5 5 5 M5 12v8h14v-8",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  done: "M5 12.5 10 17l9-10",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export function IconBox({ name, size = 27 }: { name: IconName; size?: number }) {
  return (
    <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[17px] bg-tint text-accent">
      <Icon name={name} size={size} />
    </span>
  );
}
