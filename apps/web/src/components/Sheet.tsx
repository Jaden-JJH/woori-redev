"use client";

import { useRef, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * 바텀시트. 네이티브 dialog 로 모달 초점 가두기, Esc 닫기, 닫은 뒤 여는 버튼으로 초점 복귀를 얻는다.
 * trigger 는 여는 버튼의 내용과 스타일.
 */
export function Sheet({
  trigger,
  triggerClassName,
  triggerLabel,
  title,
  children,
}: {
  trigger: ReactNode;
  triggerClassName: string;
  triggerLabel?: string;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        className="sheet"
        aria-label={title}
        onClick={(e) => {
          // 바깥(배경) 을 누르면 닫는다
          if (e.target === ref.current) ref.current.close();
        }}
      >
        <div className="max-h-[88dvh] overflow-y-auto px-6 pt-5 pb-[calc(28px+env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-bar" aria-hidden />
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[1.45rem] leading-snug font-extrabold tracking-tight text-balance">{title}</h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-tint text-accent"
              aria-label="닫기"
            >
              <Icon name="close" size={22} />
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </dialog>
    </>
  );
}
