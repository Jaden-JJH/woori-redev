import "server-only";
import { notFound } from "next/navigation";
import type { Checklist, Money, Timeline, ZoneSummary } from "./types";

// 서버 컴포넌트 전용. 결정적 화면 데이터는 5분 캐시한다(콘텐츠는 사람이 검수한 뒤에만 바뀐다).
const API_URL = process.env.API_URL ?? "http://localhost:8000";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}/v1${path}`, { next: { revalidate: 300 } });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`API ${path} ${res.status}`);
  return res.json() as Promise<T>;
}

export const api = {
  zones: () => get<{ zones: ZoneSummary[] }>("/zones").then((d) => d.zones),
  timeline: (zone: string) => get<Timeline>(`/zones/${encodeURIComponent(zone)}/timeline`),
  checklist: (zone: string, type: string) =>
    get<Checklist>(`/zones/${encodeURIComponent(zone)}/checklist?type=${encodeURIComponent(type)}`),
  money: (zone: string, type: string) =>
    get<Money>(`/zones/${encodeURIComponent(zone)}/money?type=${encodeURIComponent(type)}`),
  suggestions: (type: string) =>
    get<{ suggestions: string[] }>(`/suggestions?type=${encodeURIComponent(type)}`).then((d) => d.suggestions),
};
