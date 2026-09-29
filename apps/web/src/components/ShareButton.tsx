"use client";

import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Icon } from "./Icon";

/**
 * 지금 화면 공유. 휴대폰 기본 공유창(카카오톡, 문자 등)을 먼저 쓰고, 없으면 링크 복사와 문자 보내기를 보여준다.
 * 링크에는 구역과 입장만 들어간다(개인정보 없음).
 */
export function ShareButton() {
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  const url = () => `${window.location.origin}${path}`;
  const title = () => document.title;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: title(), url: url() });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    setCopied(false);
    dialog.current?.showModal();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label="공유하기"
        className="grid h-12 w-12 place-items-center rounded-xl text-ink"
      >
        <Icon name="share" size={22} />
      </button>
      <dialog
        ref={dialog}
        className="sheet"
        aria-label="공유하기"
        onClick={(e) => {
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="px-6 pt-5 pb-[calc(28px+env(safe-area-inset-bottom))]">
          <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-bar" aria-hidden />
          <div className="grid grid-cols-3 gap-3">
            <button type="button" onClick={copy} className="press flex flex-col items-center gap-2 text-[0.85rem] font-semibold">
              <span
                className={`grid h-16 w-16 place-items-center rounded-[20px] ${copied ? "bg-accent text-white" : "bg-tint text-accent"}`}
              >
                <Icon name={copied ? "done" : "link"} size={28} />
              </span>
              <span aria-live="polite">{copied ? "복사됨" : "링크 복사"}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.href = `sms:?&body=${encodeURIComponent(`${title()} ${url()}`)}`;
              }}
              className="press flex flex-col items-center gap-2 text-[0.85rem] font-semibold"
            >
              <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-tint text-accent">
                <Icon name="chat" size={28} />
              </span>
              문자
            </button>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="press flex flex-col items-center gap-2 text-[0.85rem] font-semibold text-ink-mute"
            >
              <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-tint-2">
                <Icon name="close" size={26} />
              </span>
              닫기
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
