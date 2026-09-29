"use client";

import { useEffect } from "react";
import { useLocal, writeLocal } from "@/lib/local";

const KEY = "woori.font";

/** 첫 화면 그리기 전에 글씨 크기를 적용해 깜빡임을 막는다. */
export function FontSizeScript() {
  const code = `try{if(localStorage.getItem('${KEY}')==='large')document.documentElement.dataset.font='large'}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function FontSizeToggle() {
  const large = useLocal(KEY) === "large";

  useEffect(() => {
    if (large) document.documentElement.dataset.font = "large";
    else delete document.documentElement.dataset.font;
  }, [large]);

  function toggle() {
    writeLocal(KEY, large ? "normal" : "large");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={large}
      className="tap rounded-full border border-white/30 px-3 text-sm font-semibold text-white/90"
    >
      {large ? "보통 글씨" : "큰 글씨"}
    </button>
  );
}
