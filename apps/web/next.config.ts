import type { NextConfig } from "next";

// 브라우저는 같은 도메인의 /api 로 부르고, Next 가 백엔드로 넘긴다(CORS 없음, 백엔드 주소 비노출).
const API_URL = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
