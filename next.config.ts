import type { NextConfig } from "next";

/**
 * Vercel only.
 *
 * The GitHub Pages mirror is gone: /api/submissions is a route handler, and
 * `output: "export"` cannot build one. Keeping the workflow would have produced
 * a static site that looked fine and silently failed every submission — the
 * worst failure mode, because nothing turns red.
 */
const nextConfig: NextConfig = {
  images: {
    // Kept for user-submitted can photos, which will come from Supabase Storage.
    remotePatterns: [
      { protocol: "https", hostname: "images.openfoodfacts.org" },
      // user-uploaded can photos live in Supabase Storage
      { protocol: "https", hostname: "ujuyfevyaokbvfmmpdeu.supabase.co" },
    ],
  },
};

export default nextConfig;
