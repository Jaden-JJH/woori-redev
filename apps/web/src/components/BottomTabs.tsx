"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

export function BottomTabs({ zone, type }: { zone: string; type: string }) {
  const path = usePathname();
  const base = `/z/${zone}/${type}`;
  const tabs: { href: string; label: string; icon: IconName; active: boolean }[] = [
    { href: base, label: "내 구역", icon: "home", active: path === base },
    { href: `${base}/checklist`, label: "챙길 일", icon: "check", active: path.startsWith(`${base}/checklist`) },
    { href: `${base}/money`, label: "돈 캘린더", icon: "money", active: path.startsWith(`${base}/money`) },
    {
      href: `${base}/ask`,
      label: "물어보기",
      icon: "chat",
      active: path.startsWith(`${base}/ask`) || path.startsWith(`${base}/doc`),
    },
  ];
  return (
    <nav
      aria-label="주요 메뉴"
      className="sticky bottom-0 z-20 mt-auto grid grid-cols-4 border-t border-line bg-[#fffdf9f5] px-2 pt-1.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur-md"
    >
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[0.72rem] ${
            t.active ? "font-extrabold text-accent" : "font-medium text-ink-mute"
          }`}
        >
          <Icon name={t.icon} size={24} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
