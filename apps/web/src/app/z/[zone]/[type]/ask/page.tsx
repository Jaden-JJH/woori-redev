import Link from "next/link";
import { Chip, Header } from "@/components/Header";
import { api } from "@/lib/api";
import { residentLabel, type ResidentType } from "@/lib/types";
import { AskClient } from "./AskClient";

export default async function AskPage({ params }: PageProps<"/z/[zone]/[type]/ask">) {
  const { zone, type } = await params;
  const [t, suggestions] = await Promise.all([api.timeline(zone), api.suggestions(type)]);
  return (
    <main className="flex flex-1 flex-col">
      <Header
        eyebrow="물어보기"
        title={<>궁금한 걸<br />쉬운 말로 답해드려요</>}
        chips={
          <>
            <Chip href={`/z/${zone}`}>{`${t.zone.name}, ${residentLabel(type)}`}</Chip>
            <Link
              href={`/z/${zone}/${type}/doc`}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-amber-accent px-4 text-[0.9rem] font-bold text-navy-900"
            >
              📷 받은 문서 사진으로 물어보기
            </Link>
          </>
        }
      />
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
