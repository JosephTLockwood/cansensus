"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuth, type AuthState } from "@/lib/use-auth";
import { HandlePicker } from "./HandlePicker";

/**
 * One auth state for the whole page.
 *
 * The nav needs it (sign in / sign out) and the catalog needs it (which ratings
 * source to use). Calling useAuth() in both places would create two independent
 * sessions that could disagree, so it lives in a context.
 */
const AuthContext = createContext<AuthState | null>(null);

export function useAuthContext(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
      {/* Signed in with Google but no public identity yet — block until they
          have chosen the name Cansensus will show. */}
      {auth.needsHandle && (
        <HandlePicker
          onClaim={auth.claimHandle}
          onCheck={auth.checkHandle}
          onSignOut={auth.signOut}
        />
      )}
    </AuthContext.Provider>
  );
}
