/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export: the console is a single client-side screen that talks to
  // the FastAPI backend over SSE. Exporting to plain HTML/JS lets FastAPI
  // serve the whole app from one Cloud Run service at one URL — no separate
  // Node server, no second deploy. Output lands in `frontend/out/`.
  output: "export",
  // Cloud Run serves the exported assets behind FastAPI's StaticFiles mount;
  // trailing slash keeps directory-style routes resolvable as index.html.
  trailingSlash: true,
  images: { unoptimized: true },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
