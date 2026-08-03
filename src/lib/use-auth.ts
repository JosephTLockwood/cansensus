"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "./supabase/client";

export type Profile = { id: string; handle: string };

export type AuthState = {
  /** false until the initial session lookup finishes, to avoid a signed-out flash */
  ready: boolean;
  session: Session | null;
  /** null when signed out, or signed in but no handle chosen yet */
  profile: Profile | null;
  /** true when signed in but still needs to pick a handle */
  needsHandle: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  claimHandle: (handle: string) => Promise<{ error: string | null }>;
  checkHandle: (handle: string) => Promise<boolean>;
};

export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;

/**
 * Session plus the profile that carries the user's chosen handle.
 *
 * These are separate on purpose: signing in with Google creates an auth user
 * immediately, but no public identity. Until the user picks a handle there is
 * nothing about them visible to anyone else — their Google name and email never
 * leave auth.users.
 */
export function useAuth(): AuthState {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!supabase) return;
      const { data } = await supabase
        .from("profiles")
        .select("id, handle")
        .eq("id", userId)
        .maybeSingle();
      setProfile((data as Profile) ?? null);
    },
    [supabase],
  );

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      if (active) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        if (nextSession?.user) void loadProfile(nextSession.user.id);
        else setProfile(null);
      },
    );

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile, supabase]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: "Sign-in is not configured yet." };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + window.location.pathname,
        // We want an identity, not access to anything of theirs.
        scopes: "email profile",
      },
    });
    return { error: error?.message ?? null };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }, [supabase]);

  const checkHandle = useCallback(
    async (handle: string) => {
      if (!supabase) return false;
      if (!HANDLE_PATTERN.test(handle)) return false;
      // security-definer RPC, so the form never reads the profiles table
      const { data, error } = await supabase.rpc("handle_available", {
        candidate: handle,
      });
      return !error && data === true;
    },
    [supabase],
  );

  const claimHandle = useCallback(
    async (handle: string) => {
      if (!supabase) return { error: "Sign-in is not configured yet." };
      const userId = session?.user?.id;
      if (!userId) return { error: "You need to sign in first." };
      if (!HANDLE_PATTERN.test(handle)) {
        return {
          error: "3-20 characters, lowercase letters, numbers and underscores.",
        };
      }
      const { error } = await supabase
        .from("profiles")
        .insert({ id: userId, handle });
      if (error) {
        // 23505 unique_violation, 23514 check_violation (reserved handle)
        if (error.code === "23505") return { error: "That handle is taken." };
        if (error.code === "23514") return { error: "That handle is reserved." };
        return { error: error.message };
      }
      setProfile({ id: userId, handle });
      return { error: null };
    },
    [session, supabase],
  );

  return {
    ready,
    session,
    profile,
    needsHandle: Boolean(session) && profile === null && ready,
    configured: isSupabaseConfigured,
    signInWithGoogle,
    signOut,
    claimHandle,
    checkHandle,
  };
}
