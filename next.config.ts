import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      {
        // O navegador precisa rever o service worker a cada visita, senão uma
        // versão antiga fica presa nos aparelhos.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache" }],
      },
      {
        // The cédula artwork never changes without a new filename, and the
        // whole point of this site is to not pay for bandwidth twice.
        source: "/:file*.(webp|jpg|png|svg)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
