import Link from "next/link";
import { Icon } from "@/components/Icon";
import { TopBar } from "@/components/TopBar";
import { ZoneContext } from "@/components/ZoneContext";
import { api } from "@/lib/api";
import type { ResidentType } from "@/lib/types";
import { AskClient } from "./AskClient";

export default async function AskPage({ params }: PageProps<"/z/[zone]/[type]/ask">) {
  const { zone, type } = await params;
  const [t, suggestions] = await Promise.all([api.timeline(zone), api.suggestions(type)]);
  return (
    <main className="flex flex-1 flex-col">
      <TopBar back={{ href: `/z/${zone}/${type}`, label: "내 구역" }} />
      <div className="px-6">
        <ZoneContext zoneId={zone} zoneName={t.zone.name} type={type} path="/ask" />
        <h1 className="mt-2 text-[1.5rem] leading-tight font-extrabold tracking-tight">
          궁금한 걸
          <br />
          <span className="text-accent">쉬운 말</span>로 답해드려요
        </h1>
        <Link
          href={`/z/${zone}/${type}/doc`}
          className="press mt-4 flex items-center gap-3 rounded-[15px] border border-line bg-white px-4 py-3"
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-tint text-accent">
            <Icon name="camera" size={24} />
          </span>
          <span className="min-w-0 flex-1">
            <b className="block text-[0.95rem]">받은 문서를 사진으로 물어보기</b>
            <span className="text-[0.8rem] text-ink-mute">통지서, 안내문을 세 줄로 풀어드려요</span>
          </span>
          <Icon name="arrow" size={20} className="text-accent" />
        </Link>
      </div>
      <AskClient
        zoneId={zone}
        zoneName={t.zone.name}
        residentType={type as ResidentType}
        suggestions={suggestions}
        asOf={t.zone.as_of}
      />
    </main>
  );
}
