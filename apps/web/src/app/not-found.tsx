import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <p className="text-2xl font-extrabold">찾는 화면이 없어요</p>
      <p className="text-ink-soft">구역을 다시 골라 주세요.</p>
      <Link href="/" className="tap flex items-center rounded-2xl bg-navy-700 px-6 font-bold text-white">
        처음으로
      </Link>
    </main>
  );
}
