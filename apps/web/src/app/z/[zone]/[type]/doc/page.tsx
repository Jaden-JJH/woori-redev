import { Chip, Header } from "@/components/Header";
import { api } from "@/lib/api";
import { residentLabel, type ResidentType } from "@/lib/types";
import { DocClient } from "./DocClient";

export default async function DocPage({ params }: PageProps<"/z/[zone]/[type]/doc">) {
  const { zone, type } = await params;
  const t = await api.timeline(zone);
  return (
    <main className="flex flex-1 flex-col">
      <Header
        eyebrow="문서 해설"
        back={{ href: `/z/${zone}/${type}/ask`, label: "물어보기" }}
        title={<>받으신 통지서,<br />같이 읽어드릴게요</>}
        chips={<Chip href={`/z/${zone}`}>{`${t.zone.name}, ${residentLabel(type)}`}</Chip>}
      />
      <DocClient zoneId={zone} residentType={type as ResidentType} />
    </main>
  );
}
