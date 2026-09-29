"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
      <path d="M3 21V10l5-3v3l5-3v3l5-3v14H3Zm3-3h3v-3H6v3Zm6 0h3v-3h-3v3Z" />
    </svg>
  );
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
      <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconWon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M4 6l3.5 12L12 7l4.5 11L20 6M3 10.5h18M3 13.5h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 5h16v11H9l-5 4V5Z" strokeLinejoin="round" />
      <circle cx="9" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="10.5" r="1" fill="currentColor" />
      <circle cx="15" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function BottomTabs({ zone, type }: { zone: string; type: string }) {
  const path = usePathname();
  const base = `/z/${zone}/${type}`;
  const tabs = [
    { href: base, label: "내 구역", icon: <IconHome />, active: path === base },
    { href: `${base}/checklist`, label: "체크리스트", icon: <IconCheck />, active: path.startsWith(`${base}/checklist`) },
    { href: `${base}/money`, label: "돈 캘린더", icon: <IconWon />, active: path.startsWith(`${base}/money`) },
    {
      href: `${base}/ask`,
      label: "물어보기",
      icon: <IconChat />,
      active: path.startsWith(`${base}/ask`) || path.startsWith(`${base}/doc`),
    },
  ];
  return (
    <nav
      aria-label="주요 메뉴"
      className="sticky bottom-0 z-20 mt-auto grid grid-cols-4 border-t border-navy-100 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex min-h-[64px] flex-col items-center justify-center gap-1 text-[0.8rem] font-bold ${
            t.active ? "text-navy-700" : "text-ink-mute"
          }`}
        >
          {t.icon}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
