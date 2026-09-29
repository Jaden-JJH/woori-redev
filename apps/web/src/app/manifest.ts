import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "우리동네 재개발 비서",
    short_name: "재개발 비서",
    description: "성남 원도심 정비구역 주민을 위한 안내 서비스",
    lang: "ko",
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf5",
    theme_color: "#fffaf5",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
