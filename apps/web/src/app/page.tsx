import Link from "next/link";
import { Header } from "@/components/Header";
import { LastVisit } from "@/components/LastVisit";
import { api } from "@/lib/api";

export default async function Home() {
  const zones = await api.zones();
  return (
    <main className="flex flex-1 flex-col">
      <Header eyebrow="우리동네 재개발 비서" title={<>어느 동네가<br />궁금하세요?</>} />
      <div className="flex flex-col gap-3 px-4 py-5">
        <LastVisit zones={zones.map((z) => ({ id: z.id, name: z.name }))} />
        <p className="px-1 text-[0.95rem] text-ink-soft">주소는 묻지 않아요. 사시는 구역을 골라 주세요.</p>
        {zones.map((z) => (
          <Link
            key={z.id}
            href={`/z/${z.id}`}
            className="flex items-center justify-between gap-3 rounded-3xl bg-white p-5 shadow-[0_2px_10px_rgba(21,40,79,0.06)] active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="text-xl font-extrabold text-ink">{z.name}</p>
              <p className="mt-1 text-[0.9rem] text-ink-soft">
                {z.district} {z.impl_type === "public" ? `, ${z.developer} 시행` : ", 조합 시행"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-cream px-3 py-1.5 text-[0.85rem] font-bold text-orange-accent">
              {z.current_stage.name}
            </span>
          </Link>
        ))}
        <Link href="/about" className="tap mt-2 flex items-center justify-center text-[0.95rem] font-semibold text-navy-700 underline">
          이 서비스는 무엇을 답하고, 무엇을 답하지 않나요?
        </Link>
      </div>
    </main>
  );
}
