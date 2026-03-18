/** @type {import('next').NextConfig} */

const API_BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const apiRoutes = [
  { source: "/health", destination: `${API_BACKEND}/health` },
  { source: "/summary", destination: `${API_BACKEND}/summary` },
  { source: "/assets/:path*", destination: `${API_BACKEND}/assets/:path*` },
  { source: "/news/:path*", destination: `${API_BACKEND}/news/:path*` },
  { source: "/predictions/:path*", destination: `${API_BACKEND}/predictions/:path*` },
  { source: "/train", destination: `${API_BACKEND}/train` },
];

const nextConfig = {
  // In dev: proxy API calls to the local FastAPI server (localhost:8000).
  // In production (Vercel): vercel.json rewrites handle routing to the Python serverless function.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: apiRoutes,
      fallback: [],
    };
  },
};

module.exports = nextConfig;
