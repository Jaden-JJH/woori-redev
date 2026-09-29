/**
 * 동네 그림. 상징적 삽화이며 실제 구역의 건물, 경계, 완공 계획을 묘사하지 않는다.
 * variant: town(기본), moving(이주 단계: 이사 상자와 안내문)
 */
export function TownArt({ variant = "town" }: { variant?: "town" | "moving" }) {
  const a = "#d97745";
  const b = "#b85435";
  const light = "#ffdbb8";
  if (variant === "moving") {
    return (
      <svg className="arrive block h-[162px] w-full" viewBox="0 0 340 162" fill="none" aria-hidden="true">
        <ellipse cx="173" cy="147" rx="132" ry="8" fill={b} opacity=".09" />
        <rect x="126" y="25" width="89" height="117" rx="9" fill="#fffaf1" transform="rotate(9 126 25)" />
        <rect x="150" y="24" width="41" height="14" rx="6" fill={b} transform="rotate(9 150 24)" />
        <path d="m140 61 5 6 9-11m-18 30 5 6 9-11" stroke={b} strokeWidth="3" strokeLinecap="round" />
        <path d="m161 63 27 4m-31 17 27 4m-46 17 43 7" stroke="#dcb593" strokeWidth="4" strokeLinecap="round" />
        <path d="m50 97 48-22 55 22v49H50V97Z" fill="#ce7544" />
        <path d="m50 97 49 17 54-17-55-22-48 22Z" fill="#eda773" />
        <path d="M99 114v33" stroke="#b05a30" strokeWidth="2" />
        <path d="m80 83 53 19v14l-16 5v-16L64 90" fill="#ffdab0" />
        <path
          d="M237 146v-30m0 14c-25-1-28-14-27-28 19-1 29 11 27 28Zm0-13c1-23 11-32 24-32 2 20-8 29-24 32Z"
          fill="#71846a"
        />
        <path d="M224 132h28l-4 16h-20l-4-16Z" fill="#fff8ea" />
        <path d="M74 38v12m-6-6h12" stroke="#d58c51" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="arrive block h-[162px] w-full" viewBox="0 0 340 162" fill="none" aria-hidden="true">
      <ellipse cx="170" cy="145" rx="151" ry="9" fill={b} opacity=".08" />
      <path d="M18 143h302" stroke={b} opacity=".24" strokeWidth="2" />
      <rect x="193" y="40" width="77" height="101" rx="7" fill={a} />
      <path d="M207 31h49a5 5 0 0 1 5 5v6h-59v-6a5 5 0 0 1 5-5Z" fill={b} />
      <path
        d="M205 58h13v15h-13zm23 0h13v15h-13zm23 0h9v15h-9zm-46 27h13v15h-13zm23 0h13v15h-13zm23 0h9v15h-9z"
        fill={light}
      />
      <path d="M221 141v-27h22v27" fill={b} />
      <rect x="65" y="93" width="89" height="49" rx="4" fill="#fffdf5" />
      <path d="m54 96 54-45 58 45H54Z" fill={b} />
      <path d="m80 85 28-24 30 24" stroke={a} strokeWidth="4" />
      <rect x="82" y="107" width="18" height="17" rx="2" fill={light} />
      <rect x="116" y="106" width="19" height="36" rx="3" fill={a} />
      <path d="M38 144v-35m260 35v-42" stroke={b} strokeWidth="5" />
      <ellipse cx="38" cy="102" rx="17" ry="23" fill={a} />
      <ellipse cx="298" cy="91" rx="18" ry="27" fill={light} />
      <path d="M174 136v-24m-8 0h16" stroke={a} strokeWidth="4" />
      <rect x="149" y="9" width="47" height="32" rx="14" fill="white" />
      <path d="m169 40 3 7 6-7" fill="white" />
      <path d="m164 25 5 5 11-12" stroke={b} strokeWidth="3" strokeLinecap="round" />
      <circle cx="54" cy="41" r="9" fill={light} />
      <path d="M283 32v10m-5-5h10" stroke={a} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 단계 순서를 보여주는 칸 막대. 공정률이나 남은 기간이 아니다. */
export function StageBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="mt-2 flex gap-1" role="img" aria-label={`전체 ${total}단계 중 ${step}단계`}>
      {Array.from({ length: total }, (_, i) => (
        <i
          key={i}
          className={`block flex-1 rounded-full ${
            i < step - 1 ? "h-[5px] bg-accent" : i === step - 1 ? "h-[9px] -translate-y-[2px] bg-accent" : "h-[5px] bg-bar"
          }`}
        />
      ))}
    </div>
  );
}
