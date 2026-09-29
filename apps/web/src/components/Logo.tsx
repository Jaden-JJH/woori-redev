/** 서비스 로고 마크. src/app/icon.svg 와 같은 그림이다. */
export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="15" fill="#a84528" />
      <path
        d="M13.5 29.5 32 15l18.5 14.5V45a3.5 3.5 0 0 1-3.5 3.5H25l-8 6.5v-6.5a3.5 3.5 0 0 1-3.5-3.5Z"
        fill="#fffaf5"
      />
      <rect x="27.5" y="34" width="9" height="14.5" rx="2" fill="#a84528" />
      <circle cx="47.5" cy="15.5" r="3.5" fill="#ffc9a0" />
    </svg>
  );
}
