import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained build (.next/standalone) for a small Docker image.
  output: "standalone",
};

export default nextConfig;
