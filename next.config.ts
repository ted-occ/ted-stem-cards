import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["nfc-pcsc", "pcsclite"],
};

export default nextConfig;
