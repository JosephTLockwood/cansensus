"use client";

import { useState } from "react";
import { useAuthContext } from "./AuthProvider";

/**
 * The nav's right-hand slot. Falls back to the original "Cast a vote" anchor
 * when Supabase is not configured, so the page is never broken by a missing
 * env var — it just behaves like the pre-accounts version.
 */
export function AuthControls() {
  const { configured, ready, session, profile, signInWithGoogle, signOut } =
    useAuthContext();
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <a href="#rate" className="navCta">
        Cast a vote
      </a>
    );
  }

  // Avoid flashing "Sign in" at someone who is already signed in.
  if (!ready) {
    return <span className="navAuthPlaceholder mono">…</span>;
  }

  if (session && profile) {
    return (
      <div className="navAuth">
        <span className="navHandle mono" title="Your public handle">
          @{profile.handle}
        </span>
        <button
          type="button"
          className="navSignOut mono"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="navCta"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { error } = await signInWithGoogle();
        if (error) setBusy(false);
        // on success the browser navigates to Google, so no reset needed
      }}
    >
      {busy ? "Redirecting…" : "Sign in with Google"}
    </button>
  );
}
