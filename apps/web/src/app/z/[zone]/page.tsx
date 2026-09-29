import Link from "next/link";
import { Chip, Header } from "@/components/Header";
import { api } from "@/lib/api";
import { RESIDENT_TYPES } from "@/lib/types";

export default async function ZoneTypePage({ params }: PageProps<"/z/[zone]">) {
  const { zone } = await params;
  const t = await api.timeline(zone);
  return (
    <main className="flex flex-1 flex-col">
      <Header
        eyebrow="우리동네 재개발 비서"
        back={{ href: "/", label: "구역 다시 고르기" }}
        title={<>{t.zone.name}에서<br />어떤 입장이세요?</>}
        chips={<Chip>{`${t.zone.district} ${t.zone.name}`}</Chip>}
      />
      <div className="flex flex-col gap-3 px-4 py-5">
        <p className="px-1 text-[0.95rem] text-ink-soft">입장에 따라 받을 수 있는 권리와 할 일이 달라요.</p>
        {RESIDENT_TYPES.map((r) => (
          <Link
            key={r.id}
            href={`/z/${zone}/${r.id}`}
            className="rounded-3xl bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)] active:scale-[0.99]"
          >
            <p className="text-xl font-extrabold text-ink">{r.label}</p>
            <p className="mt-1 text-[0.95rem] text-ink-soft">{r.desc}</p>
          </Link>
        ))}
        <p className="px-1 pt-2 text-[0.85rem] text-ink-mute">
          세입자와 가게 세입자도 조합원이 아니어도 받을 수 있는 권리가 있어요.
        </p>
      </div>
    </main>
  );
}
