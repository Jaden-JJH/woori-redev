import { notFound } from "next/navigation";
import { BottomTabs } from "@/components/BottomTabs";
import { RememberVisit } from "@/components/LastVisit";
import { isResidentType } from "@/lib/types";

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
