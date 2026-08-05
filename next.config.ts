import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "playwright"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
