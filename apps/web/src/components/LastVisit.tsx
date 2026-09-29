"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLocal, writeLocal } from "@/lib/local";
import { residentLabel } from "@/lib/types";

const KEY = "woori.last";

export function rememberVisit(zone: string, type: string) {
  writeLocal(KEY, JSON.stringify({ zone, type }));
}

function parse(raw: string | null): { zone: string; type: string } | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function RememberVisit({ zone, type }: { zone: string; type: string }) {
  useEffect(() => rememberVisit(zone, type), [zone, type]);
  return null;
}

export function LastVisit({ zones }: { zones: { id: string; name: string }[] }) {
  const last = parse(useLocal(KEY));
  const zone = last ? zones.find((z) => z.id === last.zone) : undefined;
  if (!last || !zone) return null;
  return (
    <Link
      href={`/z/${zone.id}/${last.type}`}
      className="tap flex items-center justify-between rounded-2xl border border-navy-100 bg-navy-50 px-5 py-3 font-bold text-navy-700"
    >
      <span>
        지난번에 본 {zone.name}, {residentLabel(last.type)}
      </span>
      <span aria-hidden>›</span>
    </Link>
  );
}
