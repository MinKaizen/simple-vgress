import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable image optimization for screenshots
  images: {
    unoptimized: true,
  },
  
  // Server-side packages that shouldn't be bundled for client
  serverExternalPackages: [
    'better-sqlite3',
    'sharp',
    'playwright',
    'jimp',
  ],
  
  // Enable Turbopack (Next.js 16 default) with empty config
  turbopack: {},
};

export default nextConfig;
