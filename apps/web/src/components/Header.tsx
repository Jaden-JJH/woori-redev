import Link from "next/link";
import type { ReactNode } from "react";
import { FontSizeToggle } from "./FontSize";

export function Header({
  eyebrow,
  title,
  chips,
  back,
}: {
  eyebrow: string;
  title: ReactNode;
  chips?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="bg-gradient-to-br from-navy-800 to-navy-700 px-5 pt-5 pb-6 text-white">
      <div className="flex items-center justify-between gap-2">
        {back ? (
          <Link href={back.href} className="tap -ml-1 flex items-center gap-1 text-base font-semibold text-white/85">
            <span aria-hidden>‹</span> {back.label}
          </Link>
        ) : (
          <p className="text-base font-semibold text-white/80">{eyebrow}</p>
        )}
        <FontSizeToggle />
      </div>
      {back ? <p className="mt-1 text-base font-semibold text-white/80">{eyebrow}</p> : null}
      <h1 className="mt-2 text-[1.6rem] leading-snug font-extrabold tracking-tight">{title}</h1>
      {chips ? <div className="mt-4 flex flex-wrap gap-2">{chips}</div> : null}
    </header>
  );
}

export function Chip({ children, tone = "glass", href }: { children: ReactNode; tone?: "glass" | "amber"; href?: string }) {
  const cls =
    tone === "amber"
      ? "bg-amber-accent text-navy-900 border-amber-accent"
      : "bg-white/12 text-white border-white/35";
  const body = (
    <span className={`inline-flex min-h-[40px] items-center rounded-full border px-4 text-[0.9rem] font-bold ${cls}`}>
      {children}
    </span>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
