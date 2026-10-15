import type { NextConfig } from "next";

const config: NextConfig = {
  // Cloudflare serves the site as static assets, so everything is prerendered at build time.
  output: "export",
  images: { unoptimized: true },
};

export default config;
