"use client";

import { useLocal, writeLocal } from "@/lib/local";

const KEY = "woori.font";

/** 첫 화면 그리기 전에 글씨 크기를 적용해 깜빡임을 막는다. */
export function FontSizeScript() {
  const code = `try{if(localStorage.getItem('${KEY}')==='large')document.documentElement.dataset.font='large'}catch(e){}`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

export function FontSizeToggle() {
  const large = useLocal(KEY) === "large";

  // 문서의 글씨 크기는 누를 때만 바꾼다. 렌더링 중에 바꾸면 첫 화면에서 크기가 풀렸다가 다시 커지며 버튼 위치가 흔들린다.
  function toggle() {
    const next = !large;
    if (next) document.documentElement.dataset.font = "large";
    else delete document.documentElement.dataset.font;
    writeLocal(KEY, next ? "large" : "normal");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={large}
      aria-label={large ? "보통 글씨로 보기" : "큰 글씨로 보기"}
      className="grid h-12 min-w-12 place-items-center rounded-xl px-2 text-[0.9rem] font-bold text-ink"
    >
      {large ? "가-" : "가+"}
    </button>
  );
}
