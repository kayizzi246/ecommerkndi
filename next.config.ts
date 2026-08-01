import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "acculifepharma.co.ug" },
      { protocol: "https", hostname: "www.acculifepharma.co.ug" },
      { protocol: "https", hostname: "7thculturetribe.com" },
      { protocol: "https", hostname: "www.7thculturetribe.com" },
      { protocol: "https", hostname: "shop.kandiug.com" },
    ],
  },
};

export default nextConfig;
