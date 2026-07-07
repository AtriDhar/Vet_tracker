import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
