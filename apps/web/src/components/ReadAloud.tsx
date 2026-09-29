"use client";

import { useEffect, useState } from "react";
import { useBrowserFlag } from "@/lib/local";

/** 브라우저 음성 합성(ko-KR)으로 읽어 준다. 음성 데이터는 기기 밖으로 나가지 않는다. */
export function ReadAloud({ text }: { text: string }) {
  const supported = useBrowserFlag(() => "speechSynthesis" in window);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="tap inline-flex items-center gap-1.5 rounded-full border border-navy-100 px-4 text-[0.85rem] font-bold text-navy-700"
    >
      <span aria-hidden>{speaking ? "■" : "▶"}</span>
      {speaking ? "그만 읽기" : "읽어주기"}
    </button>
  );
}
