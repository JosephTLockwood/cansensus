"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client.
 *
 * Auth is deliberately browser-only (PKCE, session detected from the URL on
 * return from Google) rather than going through a server route handler. That
 * keeps the whole app a static export, so the GitHub Pages mirror keeps working
 * alongside Vercel. Server routes arrive with can submissions, which genuinely
 * need the secret key.
 *
 * The publishable key is meant to ship in the client bundle — every table it
 * can reach is protected by row-level security (supabase/migrations/0002).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * False when the env vars are absent. The app must stay fully usable in that
 * case — it falls back to device-local ratings rather than erroring, so a fresh
 * clone with no Supabase project still runs.
 */
export const isSupabaseConfigured = Boolean(url && publishableKey);

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (cached) return cached;
  cached = createClient(url!, publishableKey!, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return cached;
}
