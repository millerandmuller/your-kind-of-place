import type { NextConfig } from "next";

// The browser only ever talks to this origin; app/api/[...path] proxies /api/* to the Python service.
const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
};

export default nextConfig;
