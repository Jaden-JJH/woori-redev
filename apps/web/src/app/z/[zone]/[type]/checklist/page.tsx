import { ChecklistCard } from "@/components/ChecklistCard";
import { Chip, Header } from "@/components/Header";
import { Footnote } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { residentLabel } from "@/lib/types";

export default async function ChecklistPage({ params }: PageProps<"/z/[zone]/[type]/checklist">) {
  const { zone, type } = await params;
  const c = await api.checklist(zone, type);
  const z = c.zone;
  const groups = [
    { key: "benefit", title: "받을 수 있는 지원", items: c.now.benefit },
    { key: "todo", title: "지금 해야 할 일", items: c.now.todo },
    { key: "caution", title: "꼭 알아두세요", items: c.now.caution },
  ].filter((g) => g.items.length > 0);
  return (
    <main className="flex flex-1 flex-col">
      <Header
        eyebrow="체크리스트"
        title={<>{residentLabel(type)}님이 챙길<br />권리와 할 일이에요</>}
        chips={
          <>
            <Chip href={`/z/${zone}`}>{`${z.name}, ${residentLabel(type)}`}</Chip>
            <Chip tone="amber">{`지금: ${z.current_stage.name}`}</Chip>
          </>
        }
      />
      <div className="flex flex-col gap-6 px-4 py-5">
        {groups.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-ink-soft">이 단계에서 따로 챙길 일은 없어요. 아래 다가오는 일을 미리 봐 두세요.</p>
        ) : null}
        {groups.map((g) => (
          <section key={g.key} className="flex flex-col gap-3">
            <h2 className="px-1 text-lg font-extrabold">{g.title}</h2>
            {g.items.map((i) => (
              <ChecklistCard key={i.id} item={i} />
            ))}
          </section>
        ))}
        {c.upcoming.length > 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="px-1 text-lg font-extrabold">다가오는 일</h2>
            <p className="-mt-1 px-1 text-[0.9rem] text-ink-soft">다음 단계들에서 챙길 일이에요. 미리 알아 두면 기한을 놓치지 않아요.</p>
            {c.upcoming.map((i) => (
              <ChecklistCard key={i.id} item={i} showStage />
            ))}
          </section>
        ) : null}
      </div>
      <Footnote asOf={formatDate(z.as_of)} />
    </main>
  );
}
