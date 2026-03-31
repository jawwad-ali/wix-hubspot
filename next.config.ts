import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Dashboard pages — allow embedding in Wix iframe
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.wix.com https://*.editorx.com https://*.wixstudio.com",
          },
          {
            // Remove X-Frame-Options to allow iframe embedding
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
        ],
      },
      {
        // Embed form page — allow embedding anywhere
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
        ],
      },
      {
        // API routes — CORS for cross-origin requests
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
