import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["nfc-pcsc", "pcsclite", "better-sqlite3"],
};

export default nextConfig;
