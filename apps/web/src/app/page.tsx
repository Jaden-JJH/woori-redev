import Link from "next/link";
import { Icon } from "@/components/Icon";
import { LastVisit } from "@/components/LastVisit";
import { StageBar, TownArt } from "@/components/TownArt";
import { TopBar } from "@/components/TopBar";
import { Footnote } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { stageShort } from "@/lib/guide";

export default async function Home() {
  const zones = await api.zones();
  const asOf = zones.map((z) => z.as_of).sort().at(-1) ?? "";
  return (
    <main className="flex flex-1 flex-col">
      <div className="bg-gradient-to-b from-paper from-25% to-peach pb-4">
        <TopBar />
        <div className="px-6">
          <h1 className="mt-2 text-[1.67rem] leading-tight font-extrabold tracking-tight">
            어느 동네가
            <br />
            <span className="text-accent">궁금하세요?</span>
          </h1>
          <p className="mt-2 text-[0.95rem] text-ink-mute">주소는 묻지 않아요. 사시는 구역을 골라 주세요.</p>
          <TownArt />
        </div>
      </div>
      <div className="flex flex-col gap-3 px-5 py-5">
        <LastVisit zones={zones.map((z) => ({ id: z.id, name: z.name }))} />
        {zones.map((z) => (
          <Link
            key={z.id}
            href={`/z/${z.id}`}
            className="press rounded-[18px] border border-line bg-white px-5 py-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
              <div className="min-w-0">
                <p className="text-[1.2rem] font-extrabold whitespace-nowrap">{z.name}</p>
                <p className="mt-0.5 text-[0.85rem] text-ink-mute">
                  {z.district}, {z.impl_type === "public" ? `${z.developer} 시행` : "조합 시행"}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-tint px-2.5 py-1.5 text-[0.8rem] font-bold text-accent">
                {stageShort(z.current_stage.name)}
              </span>
            </div>
            <StageBar step={z.step} total={z.total_steps} />
            <p className="mt-2 flex items-center justify-between text-[0.8rem] text-ink-mute">
              전체 {z.total_steps}단계 중 {z.step}단계
              <Icon name="arrow" size={18} className="text-accent" />
            </p>
          </Link>
        ))}
        <Link href="/about" className="tap mt-1 flex items-center justify-center gap-1.5 text-[0.9rem] font-semibold text-accent">
          이 서비스가 답하는 것과 답하지 않는 것 <Icon name="arrow" size={18} />
        </Link>
      </div>
      <Footnote asOf={formatDate(asOf)} />
    </main>
  );
}
