import type { NextConfig } from "next";

// The browser only ever talks to this origin; /api/* is proxied to the Python service.
const API_URL = process.env.API_URL ?? "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
