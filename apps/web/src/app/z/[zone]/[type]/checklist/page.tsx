import { GuideCard } from "@/components/GuideCard";
import { ShareButton } from "@/components/ShareButton";
import { TopBar } from "@/components/TopBar";
import { ZoneContext } from "@/components/ZoneContext";
import { Footnote } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { stageShort } from "@/lib/guide";

export default async function ChecklistPage({ params }: PageProps<"/z/[zone]/[type]/checklist">) {
  const { zone, type } = await params;
  const c = await api.checklist(zone, type);
  const z = c.zone;
  // 먼저 확인할 것(주의, 기한) -> 받을 수 있는 지원 -> 할 일
  const now = [
    ...c.now.caution,
    ...c.now.todo.filter((i) => i.kind === "deadline"),
    ...c.now.benefit,
    ...c.now.todo.filter((i) => i.kind !== "deadline"),
  ];
  return (
    <main className="flex flex-1 flex-col">
      <TopBar back={{ href: `/z/${zone}/${type}`, label: "내 구역" }} />
      <div className="px-6 pb-1.5">
        <ZoneContext zoneId={zone} zoneName={z.name} type={type} path="/checklist" />
        <h1 className="mt-2 mb-4 text-[1.5rem] leading-tight font-extrabold tracking-tight text-balance">
          {stageShort(z.current_stage.name)}에 챙길 일
        </h1>
      </div>
      <div className="flex flex-col gap-3.5 px-5">
        {now.length === 0 ? (
          <p className="rounded-[18px] border border-line bg-white p-5 text-ink-soft">
            이 단계에서 따로 챙길 일은 없어요. 아래 다가오는 일을 미리 봐 두세요.
          </p>
        ) : null}
        {now.map((i) => (
          <GuideCard key={i.id} item={i} />
        ))}
      </div>
      {c.upcoming.length > 0 ? (
        <section className="mt-7 flex flex-col gap-3.5 px-5">
          <div className="px-1">
            <h2 className="text-[1.17rem] font-extrabold tracking-tight">다음 단계에서 챙길 일</h2>
            <p className="mt-1 text-[0.85rem] text-ink-mute">미리 알아 두면 기한을 놓치지 않아요.</p>
          </div>
          {c.upcoming.map((i) => (
            <GuideCard key={i.id} item={i} stageLabel={i.stage ? `${i.stage.name} 때` : null} />
          ))}
        </section>
      ) : null}
      <div className="px-5 pt-6 pb-2">
        <ShareButton variant="wide" />
      </div>
      <Footnote asOf={formatDate(z.as_of)} />
    </main>
  );
}
