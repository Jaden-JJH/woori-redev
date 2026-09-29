import type { Metadata, Viewport } from "next";
import "./globals.css";
import { FontSizeScript } from "@/components/FontSize";

export const metadata: Metadata = {
  title: "우리동네 재개발 비서",
  description:
    "성남 원도심 정비구역 주민을 위한 안내 서비스. 우리 구역의 현재 단계, 지금 할 일, 받을 수 있는 지원을 공식 문서 근거와 함께 쉬운 말로 알려드려요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffaf5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <FontSizeScript />
      </head>
      <body className="min-h-dvh antialiased">
        <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col bg-paper shadow-[0_0_0_1px_rgba(111,73,48,0.06)]">
          {children}
        </div>
      </body>
    </html>
  );
}
