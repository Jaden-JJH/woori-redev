import Link from "next/link";
import { FontSizeToggle } from "./FontSize";
import { Icon } from "./Icon";
import { ShareButton } from "./ShareButton";

export function TopBar({ back }: { back?: { href: string; label: string } }) {
  return (
    <header className="flex h-[66px] items-center justify-between px-[22px]">
      {back ? (
        <Link href={back.href} className="tap -ml-1 flex items-center gap-2 text-[1rem] font-semibold text-accent">
          <Icon name="back" size={20} />
          {back.label}
        </Link>
      ) : (
        <Link href="/" className="flex items-center gap-2 text-[0.9rem] font-extrabold tracking-tight">
          <Icon name="home" size={21} className="text-accent" />
          우리동네 재개발 비서
        </Link>
      )}
      <div className="-mr-2 flex items-center">
        <ShareButton />
        <FontSizeToggle />
      </div>
    </header>
  );
}
