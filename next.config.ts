import type { NextConfig } from "next";

/**
 * Two deploy targets:
 *
 *  - Vercel (default) — a normal server build. This is the target that matters
 *    once phase 2 lands, because API routes and auth need a server.
 *  - GitHub Pages — set DEPLOY_TARGET=gh-pages to emit a fully static `out/`
 *    under the /energy-league sub-path. Works today because every bit of state
 *    is client-side; it stops being viable the moment a route handler is added,
 *    which is exactly when Vercel takes over.
 */
const isGitHubPages = process.env.DEPLOY_TARGET === "gh-pages";
const repo = "/energy-league";

const nextConfig: NextConfig = {
  images: {
    // Can photographs are served from Open Food Facts (CC BY-SA 3.0).
    remotePatterns: [
      { protocol: "https", hostname: "images.openfoodfacts.org" },
    ],
    ...(isGitHubPages ? { unoptimized: true } : {}),
  },
  ...(isGitHubPages
    ? {
        output: "export",
        basePath: repo,
        assetPrefix: `${repo}/`,
      }
    : {}),
};

export default nextConfig;
