/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The console is a single static screen that talks to the FastAPI
  // backend via SSE. We keep server-side rendering off the hot path
  // so the SSE connection is established as soon as the page mounts.
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
