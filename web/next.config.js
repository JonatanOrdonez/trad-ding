/** @type {import('next').NextConfig} */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  output: "standalone",
  // Only /train is proxied to the Python backend (needs Modal SDK).
  // All other endpoints are handled by Next.js Route Handlers.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [
        { source: "/train", destination: `${BACKEND_URL}/train` },
      ],
      fallback: [],
    };
  },
};

module.exports = nextConfig;
