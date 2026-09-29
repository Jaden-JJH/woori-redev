import Link from "next/link";
import { Icon, IconBox, type IconName } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { Pill } from "@/components/ui";
import { api } from "@/lib/api";
import { stageShort } from "@/lib/guide";
import { RESIDENT_TYPES } from "@/lib/types";

const TYPE_ICON: Record<string, IconName> = { owner: "key", tenant: "home", shop_tenant: "shop" };

export default async function ZoneTypePage({ params }: PageProps<"/z/[zone]">) {
  const { zone } = await params;
  const t = await api.timeline(zone);
  return (
    <main className="flex flex-1 flex-col">
      <TopBar back={{ href: "/", label: "구역 다시 고르기" }} />
      <div className="px-6">
        <Pill>
          <Icon name="pin" size={16} />
          {t.zone.name}, {stageShort(t.zone.current_stage.name)}
        </Pill>
        <h1 className="mt-4 text-[1.6rem] leading-tight font-extrabold tracking-tight text-balance">
          {t.zone.name}에서
          <br />
          <span className="text-accent">어떤 입장</span>이세요?
        </h1>
        <p className="mt-2 text-[0.95rem] text-ink-mute">입장에 따라 받을 수 있는 권리와 할 일이 달라요.</p>
      </div>
      <div className="flex flex-col gap-3 px-5 py-5">
        {RESIDENT_TYPES.map((r) => (
          <Link
            key={r.id}
            href={`/z/${zone}/${r.id}`}
            className="press flex items-center gap-4 rounded-[18px] border border-line bg-white px-5 py-4"
          >
            <IconBox name={TYPE_ICON[r.id]} />
            <span className="min-w-0 flex-1">
              <b className="block text-[1.15rem]">{r.label}</b>
              <span className="text-[0.9rem] text-ink-mute">{r.desc}</span>
            </span>
            <Icon name="arrow" size={20} className="text-accent" />
          </Link>
        ))}
        <p className="rounded-2xl bg-cond px-4 py-3 text-[0.9rem] leading-relaxed text-cond-ink">
          세입자와 가게 세입자도 조합원이 아니어도 받을 수 있는 권리가 있어요.
        </p>
      </div>
    </main>
  );
}
