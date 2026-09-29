import Link from "next/link";
import { RESIDENT_TYPES, residentLabel } from "@/lib/types";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";

/** 지금 보고 있는 구역과 유형. 누르면 유형을 바꾸거나 다른 구역을 고를 수 있다. */
export function ZoneContext({ zoneId, zoneName, type, path = "" }: { zoneId: string; zoneName: string; type: string; path?: string }) {
  return (
    <Sheet
      title="내 상황에 맞춰 안내해 드려요"
      triggerLabel={`${zoneName}, ${residentLabel(type)}. 구역이나 유형 바꾸기`}
      triggerClassName="flex min-h-12 items-center gap-1.5 text-[1rem] font-semibold text-ink-warm"
      trigger={
        <>
          <Icon name="pin" size={19} />
          {zoneName}
          <span className="ml-1 rounded-md bg-tint-2 px-2 py-1 text-[0.83rem]">{residentLabel(type)}</span>
          <Icon name="chevron" size={18} />
        </>
      }
    >
      <p className="text-[0.95rem] text-ink-soft">입장에 따라 챙길 권리와 할 일이 달라요. 주소, 이름, 연락처는 받지 않아요.</p>
      <div className="mt-4 flex flex-col gap-2">
        {RESIDENT_TYPES.map((r) => (
          <Link
            key={r.id}
            href={`/z/${zoneId}/${r.id}${path}`}
            aria-current={r.id === type ? "true" : undefined}
            className={`press tap flex items-center justify-between rounded-2xl border px-4 py-3 ${
              r.id === type ? "border-accent bg-tint" : "border-line bg-white"
            }`}
          >
            <span>
              <b className="block text-[1rem]">{r.label}</b>
              <span className="text-[0.85rem] text-ink-mute">{r.desc}</span>
            </span>
            {r.id === type ? <span className="text-[0.8rem] font-bold text-accent">지금 보는 중</span> : null}
          </Link>
        ))}
      </div>
      <Link href="/" className="tap mt-4 flex items-center justify-center gap-1.5 font-bold text-accent">
        다른 구역 고르기 <Icon name="arrow" size={18} />
      </Link>
    </Sheet>
  );
}
