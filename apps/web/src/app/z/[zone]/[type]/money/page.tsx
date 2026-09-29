import { ChecklistCard } from "@/components/ChecklistCard";
import { Chip, Header } from "@/components/Header";
import { Footnote } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { residentLabel } from "@/lib/types";

export default async function MoneyPage({ params }: PageProps<"/z/[zone]/[type]/money">) {
  const { zone, type } = await params;
  const m = await api.money(zone, type);
  const z = m.zone;
  return (
    <main className="flex flex-1 flex-col">
      <Header
        eyebrow="돈 캘린더"
        title={<>언제 어떤 돈이<br />오가는지 알려드려요</>}
        chips={
          <>
            <Chip href={`/z/${zone}`}>{`${z.name}, ${residentLabel(type)}`}</Chip>
            <Chip tone="amber">{`지금: ${z.current_stage.name}`}</Chip>
          </>
        }
      />
      <div className="flex flex-col gap-2 px-4 py-5">
        <p className="px-1 pb-2 text-[0.95rem] leading-relaxed text-ink-soft">
          구체적인 금액은 사람마다 달라서 적지 않아요. 법에서 정한 기준과 시기만 알려드려요.
        </p>
        <ol className="relative flex flex-col gap-6 border-l-2 border-navy-100 pl-5">
          {m.groups.map((g) => (
            <li key={g.stage.code} className="relative">
              <span
                className={`absolute top-1.5 -left-[29px] h-4 w-4 rounded-full border-4 border-paper ${
                  g.timing === "now" ? "bg-orange-accent" : "bg-navy-100"
                }`}
                aria-hidden
              />
              <p className="text-[0.85rem] font-bold text-ink-mute">{g.timing === "now" ? "지금 단계" : "다가오는 단계"}</p>
              <h2 className="text-lg font-extrabold">{g.stage.name}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {g.items.map((i) => (
                  <ChecklistCard key={i.id} item={i} />
                ))}
              </div>
            </li>
          ))}
        </ol>
        {m.groups.length === 0 ? <p className="rounded-3xl bg-white p-5 text-ink-soft">남은 돈 관련 일정이 없어요.</p> : null}
      </div>
      <Footnote asOf={formatDate(z.as_of)} />
    </main>
  );
}
