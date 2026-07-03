import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: "http://localhost:7000/:path*",
      },
    ];
  },
};

export default nextConfig;
