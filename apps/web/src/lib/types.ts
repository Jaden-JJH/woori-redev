export type ResidentType = "owner" | "tenant" | "shop_tenant";

export const RESIDENT_TYPES: { id: ResidentType; label: string; short: string; desc: string }[] = [
  { id: "owner", label: "집주인(소유자)", short: "집주인", desc: "구역 안에 집이나 땅을 갖고 있어요" },
  { id: "tenant", label: "세입자", short: "세입자", desc: "전세나 월세로 살고 있어요" },
  { id: "shop_tenant", label: "가게 세입자", short: "가게 세입자", desc: "구역 안에서 가게를 빌려 장사해요" },
];

export function residentLabel(t: string): string {
  return RESIDENT_TYPES.find((r) => r.id === t)?.short ?? t;
}

export function isResidentType(t: string): t is ResidentType {
  return RESIDENT_TYPES.some((r) => r.id === t);
}

export interface ZoneSummary {
  id: string;
  name: string;
  district: string;
  location: string;
  impl_type: "union" | "public";
  impl_label: string;
  developer: string | null;
  current_stage: { code: string; name: string };
  step: number;
  total_steps: number;
  summary: string;
  as_of: string;
}

export interface TimelineEvent {
  title: string;
  date: string | null;
  plain_desc: string | null;
  notice_no: string | null;
  notice_url: string | null;
  source_note: string | null;
}

export interface TimelineStage {
  code: string;
  seq: number;
  name: string;
  plain_desc: string;
  legal_ref: string;
  status: "done" | "current" | "planned";
  events: TimelineEvent[];
}

export interface Timeline {
  zone: ZoneSummary;
  stages: TimelineStage[];
  latest: { title: string; date: string; notice_no: string | null; plain_desc: string | null } | null;
}

export interface ChecklistItem {
  id: string;
  kind: "todo" | "benefit" | "deadline" | "caution";
  is_money: boolean;
  title: string;
  body: string;
  conditions: string | null;
  legal_basis: string;
  law_ref: string | null;
  stage: { code: string; name: string } | null;
  timing?: "now" | "upcoming";
}

export interface Checklist {
  zone: ZoneSummary;
  resident_type: ResidentType;
  now: { todo: ChecklistItem[]; benefit: ChecklistItem[]; caution: ChecklistItem[] };
  upcoming: ChecklistItem[];
}

export interface Money {
  zone: ZoneSummary;
  resident_type: ResidentType;
  groups: { stage: { code: string; name: string }; timing: "now" | "upcoming"; items: ChecklistItem[] }[];
}

export interface Contact {
  name: string;
  tel: string | null;
  note: string | null;
  url: string | null;
}

export interface Refusal {
  category: string;
  message: string;
  reason: string;
  contacts: Contact[];
  suggestions: string[];
  switch_zone_id?: string;
}

export interface Citation {
  source_label: string;
  source_type: "law" | "notice" | "zone";
  url: string | null;
  chunk_id: number | null;
  quote: string;
  exact: boolean;
}

export interface Term {
  term: string;
  plain: string | null;
  legal_ref: string | null;
}

export interface AskResult {
  trace_id: string;
  outcome: "answered" | "refused_policy" | "refused_no_evidence" | "refused_verification" | "refused_other_zone" | "error";
  summary_plain: string | null;
  points: { text: string; citations: Citation[] }[];
  next_step: string | null;
  terms: Term[];
  related_items?: RelatedItem[];
  refusal: Refusal | null;
  data_as_of: string;
}

/** 답변이 인용한 조문과 같은 조문을 근거로 하는 검수된 체크리스트 항목 */
export interface RelatedItem {
  id: string;
  kind: ChecklistItem["kind"];
  title: string;
  body: string;
  conditions: string | null;
  legal_basis: string;
}

export interface ExplainResult {
  trace_id: string;
  outcome: "explained" | "refused_policy" | "error";
  data_as_of: string;
  doc_type?: string;
  doc_type_label?: string;
  title_in_doc?: string | null;
  issuer?: string | null;
  summary_lines?: string[];
  actions?: { what: string; deadline_in_doc: string | null }[];
  amounts_in_doc?: { label: string; amount_text: string }[];
  is_estimate?: boolean | null;
  unreadable?: string | null;
  terms?: Term[];
  cautions?: { title: string; body: string; legal_basis: string }[];
  related_citations?: { source_label: string; url: string | null }[];
  refusal?: Refusal | null;
}

export interface ApiError {
  error: { code: string; message: string };
}
