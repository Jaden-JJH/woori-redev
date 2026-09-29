import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BottomTabs } from "@/components/BottomTabs";
import { RememberVisit } from "@/components/LastVisit";
import { api } from "@/lib/api";
import { stageShort } from "@/lib/guide";
import { isResidentType, residentLabel } from "@/lib/types";

// 공유한 링크의 미리보기(카카오톡, 문자)에 구역과 입장이 보이도록 한다.
export async function generateMetadata({ params }: LayoutProps<"/z/[zone]/[type]">): Promise<Metadata> {
  const { zone, type } = await params;
  if (!isResidentType(type)) return {};
  const t = await api.timeline(zone);
  const title = `${t.zone.name} ${residentLabel(type)} 안내 | 우리동네 재개발 비서`;
  const description = `지금 ${stageShort(t.zone.current_stage.name)}. 챙길 일과 받을 수 있는 지원을 공식 근거와 함께 쉬운 말로 알려드려요.`;
  return { title, description, openGraph: { title, description, locale: "ko_KR", type: "website" } };
}

export default async function ZoneLayout({ children, params }: LayoutProps<"/z/[zone]/[type]">) {
  const { zone, type } = await params;
  if (!isResidentType(type)) notFound();
  return (
    <>
      <RememberVisit zone={zone} type={type} />
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomTabs zone={zone} type={type} />
    </>
  );
}
