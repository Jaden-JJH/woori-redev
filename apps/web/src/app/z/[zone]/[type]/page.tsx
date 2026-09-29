import Link from "next/link";
import { Icon, IconBox, type IconName } from "@/components/Icon";
import { Sheet } from "@/components/Sheet";
import { StageBar, TownArt } from "@/components/TownArt";
import { TopBar } from "@/components/TopBar";
import { ZoneContext } from "@/components/ZoneContext";
import { DISCLAIMER, Pill, SourceLink, lawSearchUrl } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { KIND, stageShort, topItem } from "@/lib/guide";
import type { Timeline } from "@/lib/types";

export default async function ZoneHome({ params }: PageProps<"/z/[zone]/[type]">) {
  const { zone, type } = await params;
  const [t, c] = await Promise.all([api.timeline(zone), api.checklist(zone, type)]);
  const z = t.zone;
  const top = topItem(c.now);
  const nowCount = c.now.todo.length + c.now.benefit.length + c.now.caution.length;
  const base = `/z/${zone}/${type}`;
  const moving = z.current_stage.code === "RELOCATION";

  return (
    <main className="flex flex-1 flex-col">
      <div className="bg-gradient-to-b from-paper from-25% to-peach pb-[18px]">
        <TopBar />
        <div className="px-6">
          <ZoneContext zoneId={zone} zoneName={z.name} type={type} />
          <h1 className="mt-3 text-[1.67rem] leading-[1.27] font-extrabold tracking-tight">
            우리 동네는 지금,
            <br />
            <span className="text-accent">{stageShort(z.current_stage.name)}</span>에 있어요
          </h1>
          <TownArt variant={moving ? "moving" : "town"} />
          <div className="flex items-center justify-between text-[0.83rem]">
            <span>
              전체 {z.total_steps}단계 중 <b>{z.step}단계</b>
            </span>
            <StagesSheet t={t} />
          </div>
          <StageBar step={z.step} total={z.total_steps} />
        </div>
      </div>

      <section className="px-6 pt-6 pb-4">
        <h2 className="mb-4 text-[1.17rem] font-extrabold tracking-tight">지금, 나에게 필요한 안내</h2>
        {top ? (
          <div className="mb-4 flex items-center gap-3">
            <IconBox name={KIND[top.kind].icon} />
            <p className="text-[1rem] leading-snug font-semibold text-balance">{top.title}</p>
          </div>
        ) : (
          <p className="mb-4 text-[1rem] text-ink-soft">이 단계에서 따로 챙길 일은 없어요. 다가오는 일을 미리 봐 두세요.</p>
        )}
        <Link
          href={`${base}/checklist`}
          className="press flex min-h-[54px] items-center justify-center gap-4 rounded-[15px] bg-accent text-[1rem] font-bold text-white"
        >
          내가 챙길 일 보기{nowCount > 1 ? ` (${nowCount}개)` : ""}
          <Icon name="arrow" size={21} />
        </Link>
      </section>

      <div className="grid grid-cols-3 gap-2.5 px-5 pb-4">
        <Tool href={`${base}/money`} icon="money" label="돈 캘린더" />
        <Tool href={`${base}/doc`} icon="doc" label="문서 사진" />
        <Tool href={`${base}/ask`} icon="chat" label="물어보기" />
      </div>

      <footer className="px-6 pb-6 text-[0.72rem] leading-relaxed text-ink-mute">
        <EvidenceSheet t={t} />
        <p>데이터 기준일 {formatDate(z.as_of)}</p>
        <p>법률, 투자 자문이 아니에요.</p>
      </footer>
    </main>
  );
}

function Tool({ href, icon, label }: { href: string; icon: IconName; label: string }) {
  return (
    <Link href={href} className="press flex min-h-[85px] flex-col items-center gap-2 text-[0.9rem] whitespace-nowrap text-ink-soft">
      <span className="grid h-[51px] w-[51px] place-items-center rounded-[17px] bg-tint text-accent">
        <Icon name={icon} size={37} />
      </span>
      {label}
    </Link>
  );
}

function StagesSheet({ t }: { t: Timeline }) {
  const z = t.zone;
  return (
    <Sheet
      title={`${z.name}의 전체 진행 단계`}
      triggerClassName="flex min-h-12 items-center gap-1 text-[0.83rem] font-semibold text-accent"
      trigger={
        <>
          전체 단계 보기 <Icon name="arrow" size={16} />
        </>
      }
    >
      <p className="text-[0.85rem] text-ink-mute">
        전체 {z.total_steps}단계 중 {z.step}단계예요. 단계 수는 공사 진행률이나 남은 기간을 뜻하지 않아요.
      </p>
      <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-soft">{z.summary}</p>
      <ol className="mt-4 flex flex-col gap-2">
        {t.stages.map((s) => (
          <li
            key={s.code}
            className={`rounded-2xl px-4 py-3 ${
              s.status === "current" ? "bg-tint ring-2 ring-accent" : s.status === "done" ? "bg-white" : "bg-paper"
            }`}
          >
            <p className={`flex items-center gap-2 font-bold ${s.status === "planned" ? "text-ink-mute" : "text-ink"}`}>
              <span
                className={`grid h-7 w-7 place-items-center rounded-full text-[0.75rem] ${
                  s.status === "planned" ? "bg-tint-2 text-ink-mute" : "bg-accent text-white"
                }`}
                aria-hidden
              >
                {s.status === "done" ? "✓" : s.seq}
              </span>
              {s.name}
              {s.status === "current" ? <Pill>지금 여기</Pill> : null}
              <span className="sr-only">{s.status === "done" ? "완료" : s.status === "current" ? "현재 단계" : "예정"}</span>
            </p>
            {s.status !== "done" ? <p className="mt-1 text-[0.85rem] text-ink-soft">{s.plain_desc}</p> : null}
            {s.events.map((e) => (
              <div key={`${e.title}-${e.date}`} className="mt-2 border-t border-line pt-2 text-[0.85rem]">
                <p className="font-semibold">
                  {e.date ? `${formatDate(e.date)} ` : ""}
                  {e.title}
                </p>
                {e.plain_desc ? <p className="text-ink-soft">{e.plain_desc}</p> : null}
                {e.notice_no ? (
                  <SourceLink label={e.notice_no} href={e.notice_url} />
                ) : e.source_note ? (
                  <p className="text-[0.78rem] text-ink-mute">출처: {e.source_note}</p>
                ) : null}
              </div>
            ))}
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

function EvidenceSheet({ t }: { t: Timeline }) {
  const z = t.zone;
  const current = t.stages.find((s) => s.status === "current");
  const withNotice = t.stages.flatMap((s) => s.events.map((e) => ({ ...e, stage: s.name }))).filter((e) => e.notice_no);
  return (
    <Sheet
      title="안내의 근거를 확인할 수 있어요"
      triggerClassName="tap inline-flex items-center gap-1.5 text-[0.8rem] font-semibold text-accent underline underline-offset-4"
      trigger={
        <>
          안내 근거와 원문 확인 <Icon name="book" size={14} />
        </>
      }
    >
      <Pill>데이터 기준일 {formatDate(z.as_of)}</Pill>
      {current ? (
        <div className="mt-4">
          <p className="text-[0.85rem] font-bold text-cond-label">현재 단계의 법적 근거</p>
          <p className="mt-1 font-bold">
            {current.name}: {current.legal_ref}
          </p>
          <a
            href={lawSearchUrl(current.legal_ref)}
            target="_blank"
            rel="noreferrer"
            className="tap inline-flex items-center gap-1.5 font-bold text-accent underline underline-offset-4"
          >
            국가법령정보센터에서 원문 보기 <Icon name="arrow" size={18} />
          </a>
        </div>
      ) : null}
      <p className="mt-4 text-[0.85rem] font-bold text-cond-label">구역 진행의 근거 고시</p>
      <ul className="mt-2 flex flex-col gap-2">
        {withNotice.map((e) => (
          <li key={`${e.notice_no}-${e.title}`} className="rounded-xl bg-white px-3 py-2 text-[0.9rem]">
            <p className="font-semibold">
              {e.date ? `${formatDate(e.date)} ` : ""}
              {e.title}
            </p>
            <SourceLink label={e.notice_no!} href={e.notice_url} />
          </li>
        ))}
      </ul>
      <p className="mt-5 text-[0.75rem] leading-relaxed text-ink-mute">{DISCLAIMER}</p>
    </Sheet>
  );
}
