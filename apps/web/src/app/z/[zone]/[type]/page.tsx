import Link from "next/link";
import { Chip, Header } from "@/components/Header";
import { Card, Footnote, SectionTitle, SourceBadge, lawSearchUrl } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { residentLabel } from "@/lib/types";

export default async function TimelinePage({ params }: PageProps<"/z/[zone]/[type]">) {
  const { zone, type } = await params;
  const t = await api.timeline(zone);
  const z = t.zone;
  return (
    <main className="flex flex-1 flex-col">
      <Header
        eyebrow="우리동네 재개발 비서"
        title={<>{z.name}은 지금<br />어디까지 왔을까요?</>}
        chips={
          <>
            <Chip href={`/z/${zone}`}>{`${z.name}, ${residentLabel(type)}`}</Chip>
            <Chip tone="amber">{`${z.current_stage.name} 단계`}</Chip>
          </>
        }
      />
      <div className="flex flex-col gap-4 px-4 py-5">
        {t.latest ? (
          <div className="flex gap-4 rounded-3xl border border-cream-border bg-cream p-5">
            <span className="shrink-0 text-lg font-black text-orange-accent">NEW</span>
            <div>
              <p className="font-bold text-ink">
                {formatDate(t.latest.date)} {t.latest.title}
              </p>
              {t.latest.plain_desc ? <p className="mt-1 text-[0.95rem] text-ink-soft">{t.latest.plain_desc}</p> : null}
            </div>
          </div>
        ) : null}

        <Card>
          <SectionTitle hint={`전체 ${z.total_steps}단계 중 ${z.step}단계`}>진행 단계</SectionTitle>
          <p className="mb-4 text-[0.95rem] leading-relaxed text-ink-soft">{z.summary}</p>
          <ol className="relative">
            {t.stages.map((s, i) => (
              <li key={s.code} className="relative flex gap-4 pb-6 last:pb-0">
                {i < t.stages.length - 1 ? (
                  <span className="absolute top-9 left-[17px] h-[calc(100%-28px)] w-0.5 bg-navy-100" aria-hidden />
                ) : null}
                <StageDot status={s.status} seq={s.seq} />
                <div className="min-w-0 flex-1 pt-1">
                  <p
                    className={`flex flex-wrap items-center gap-2 text-[1.05rem] font-extrabold ${
                      s.status === "planned" ? "text-ink-mute" : "text-ink"
                    }`}
                  >
                    {s.name}
                    {s.status === "current" ? (
                      <span className="rounded-full bg-orange-accent px-2.5 py-0.5 text-[0.75rem] font-bold text-white">
                        지금 여기
                      </span>
                    ) : null}
                  </p>
                  {s.status === "current" || s.seq === z.step + 1 ? (
                    <p className="mt-1 text-[0.9rem] text-ink-soft">
                      {s.seq === z.step + 1 ? <b className="text-navy-700">다음 단계 </b> : null}
                      {s.plain_desc}
                    </p>
                  ) : null}
                  {s.events.map((e) => (
                    <div key={`${e.title}-${e.date}`} className="mt-2 rounded-2xl bg-paper px-3 py-2">
                      <p className="text-[0.9rem] font-semibold text-ink">
                        {e.date ? `${formatDate(e.date)} ` : ""}
                        {e.title}
                      </p>
                      {e.plain_desc && s.status === "done" ? (
                        <p className="mt-0.5 text-[0.85rem] text-ink-soft">{e.plain_desc}</p>
                      ) : null}
                      {e.notice_no ? (
                        <div className="mt-1.5">
                          <SourceBadge label={e.notice_no} href={e.notice_url} />
                        </div>
                      ) : e.source_note ? (
                        <p className="mt-1 text-[0.8rem] text-ink-mute">출처: {e.source_note}</p>
                      ) : null}
                    </div>
                  ))}
                  {s.status === "current" ? (
                    <div className="mt-2">
                      <SourceBadge label={s.legal_ref} href={lawSearchUrl(s.legal_ref)} />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Link
          href={`/z/${zone}/${type}/checklist`}
          className="tap flex items-center justify-center rounded-2xl bg-navy-700 px-5 py-4 text-lg font-bold text-white"
        >
          지금 제가 할 일 보기
        </Link>
      </div>
      <Footnote asOf={formatDate(z.as_of)} />
    </main>
  );
}

function StageDot({ status, seq }: { status: "done" | "current" | "planned"; seq: number }) {
  if (status === "done")
    return (
      <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-100 text-navy-700">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" aria-label="완료">
          <path d="M5 12.5 10 17l9-10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  if (status === "current")
    return (
      <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700 ring-6 ring-navy-100" aria-label="현재 단계">
        <span className="h-3.5 w-3.5 rounded-full bg-white" />
      </span>
    );
  return (
    <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-[0.9rem] font-bold text-ink-mute">
      {seq}
    </span>
  );
}
