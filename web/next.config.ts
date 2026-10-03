import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The ID upload posts one resized photo (<= 4 MB, enforced server-side).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
