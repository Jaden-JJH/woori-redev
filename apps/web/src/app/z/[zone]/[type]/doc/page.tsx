import { TopBar } from "@/components/TopBar";
import { ZoneContext } from "@/components/ZoneContext";
import { api } from "@/lib/api";
import type { ResidentType } from "@/lib/types";
import { DocClient } from "./DocClient";

export default async function DocPage({ params }: PageProps<"/z/[zone]/[type]/doc">) {
  const { zone, type } = await params;
  const t = await api.timeline(zone);
  return (
    <main className="flex flex-1 flex-col">
      <TopBar back={{ href: `/z/${zone}/${type}/ask`, label: "물어보기" }} />
      <div className="px-6">
        <ZoneContext zoneId={zone} zoneName={t.zone.name} type={type} path="/doc" />
        <h1 className="mt-2 text-[1.5rem] leading-tight font-extrabold tracking-tight text-balance">
          받으신 통지서,
          <br />
          <span className="text-accent">같이 읽어</span>드릴게요
        </h1>
      </div>
      <DocClient zoneId={zone} residentType={type as ResidentType} />
    </main>
  );
}
