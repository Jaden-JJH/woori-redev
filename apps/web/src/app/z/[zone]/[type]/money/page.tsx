import { GuideCard } from "@/components/GuideCard";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { ZoneContext } from "@/components/ZoneContext";
import { Footnote } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";

export default async function MoneyPage({ params }: PageProps<"/z/[zone]/[type]/money">) {
  const { zone, type } = await params;
  const m = await api.money(zone, type);
  const z = m.zone;
  const total = m.groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <main className="flex flex-1 flex-col">
      <TopBar back={{ href: `/z/${zone}/${type}`, label: "내 구역" }} />
      <div className="px-6 pb-2">
        <ZoneContext zoneId={zone} zoneName={z.name} type={type} path="/money" />
        <h1 className="mt-2 text-[1.5rem] leading-tight font-extrabold tracking-tight text-balance">
          언제, 어떤 돈이
          <br />
          <span className="text-accent">오가는지</span> 알려드려요
        </h1>
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-cond px-3 py-2.5 text-[0.85rem] leading-relaxed text-cond-ink">
          <Icon name="alert" size={18} className="mt-0.5 text-cond-label" />
          금액은 사람마다 달라서 적지 않아요. 법에서 정한 기준과 시기만 보여드려요.
        </p>
      </div>

      {/* 단계 흐름: 돈 이벤트가 있는 단계만 차례대로 */}
      <nav aria-label="돈이 오가는 단계" className="mt-3 flex gap-2 overflow-x-auto px-6 pb-1">
        {m.groups.map((g) => (
          <a
            key={g.stage.code}
            href={`#stage-${g.stage.code}`}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-[0.8rem] font-bold ${
              g.timing === "now" ? "border-accent bg-accent text-white" : "border-line bg-white text-ink-soft"
            }`}
          >
            {g.timing === "now" ? "지금, " : ""}
            {g.stage.name}
          </a>
        ))}
      </nav>

      <ol className="mt-4 flex flex-col gap-6 px-5">
        {m.groups.map((g) => (
          <li key={g.stage.code} id={`stage-${g.stage.code}`} className="scroll-mt-4">
            <div className="mb-3 flex items-center gap-2 px-1">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full ${
                  g.timing === "now" ? "bg-accent text-white" : "bg-tint-2 text-ink-mute"
                }`}
                aria-hidden
              >
                <Icon name="money" size={17} />
              </span>
              <div>
                <p className="text-[0.75rem] font-bold text-ink-mute">{g.timing === "now" ? "지금 단계" : "다가오는 단계"}</p>
                <h2 className="text-[1.1rem] font-extrabold tracking-tight">{g.stage.name}</h2>
              </div>
              <span className="ml-auto text-[0.8rem] text-ink-mute">{g.items.length}개</span>
            </div>
            <div className="flex flex-col gap-3">
              {g.items.map((i) => (
                <GuideCard key={i.id} item={i} />
              ))}
            </div>
          </li>
        ))}
      </ol>
      {total === 0 ? (
        <p className="mx-5 rounded-[18px] border border-line bg-white p-5 text-ink-soft">남은 돈 관련 일정이 없어요.</p>
      ) : null}
      <div className="mt-4" />
      <Footnote asOf={formatDate(z.as_of)} />
    </main>
  );
}
