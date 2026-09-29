"use client";

import { useSyncExternalStore } from "react";

/**
 * 기기 저장소(localStorage)를 React 외부 저장소로 다룬다. 서버 렌더링 때는 serverValue 를 쓴다.
 * 저장이 막힌 브라우저(사생활 보호 모드 등)에서도 화면은 정상 동작한다.
 */
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 저장이 막혀도 무시한다
  }
  listeners.forEach((l) => l());
}

export function useLocal(key: string): string | null {
  return useSyncExternalStore(subscribe, () => readLocal(key), () => null);
}

const noop = () => () => {};

/** 브라우저에서만 참인 기능 감지(음성 합성 등). */
export function useBrowserFlag(check: () => boolean): boolean {
  return useSyncExternalStore(noop, check, () => false);
}
