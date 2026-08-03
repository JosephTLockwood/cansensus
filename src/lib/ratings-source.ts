import type { Rating, Ratings } from "./types";

/**
 * THE BACKEND SEAM.
 *
 * Everything the app knows about *where ratings live* is behind this
 * interface. Today it is the browser's localStorage. In phase 2 it becomes an
 * authenticated API call, and no component changes — `LeagueApp` takes the
 * source as a prop and defaults to the local one.
 *
 * See docs/BACKEND.md for the planned `apiRatingsSource`.
 */
export interface RatingsSource {
  /** Every rating belonging to the current user. */
  load(): Promise<Ratings>;
  /** Insert or replace one rating. */
  save(drinkId: string, rating: Rating): Promise<void>;
  /** Discard everything held here. Only the local source implements it — it is
   *  called after pre-signup ratings have been migrated into an account. */
  clear?(): void;
}

const STORAGE_KEY = "edl.v1";

type StoredShape = { mine?: Ratings };

function readAll(): Ratings {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredShape;
    return parsed.mine ?? {};
  } catch {
    // Corrupt or blocked storage is not worth crashing the page over.
    return {};
  }
}

/**
 * Used while signed out. Rating requires an account, so there is nothing to
 * read and nothing may be written.
 *
 * Note this is NOT the same as deleting the local store: `migrateLocalRatings`
 * still reads localStorage directly at sign-in, so ratings made before rating
 * was gated are moved into the account rather than lost.
 */
export const signedOutRatingsSource: RatingsSource = {
  async load() {
    return {};
  },
  async save() {
    throw new Error("Sign in to rate a can.");
  },
};

/**
 * Device-local ratings. No longer used for live writes — rating is gated behind
 * sign-in — but kept as the source `migrateLocalRatings` drains on first login.
 */
export const localRatingsSource: RatingsSource = {
  async load() {
    return readAll();
  },

  async save(drinkId, rating) {
    if (typeof window === "undefined") return;
    try {
      const next: Ratings = { ...readAll(), [drinkId]: rating };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ mine: next }));
    } catch {
      // Private browsing / full quota — the in-memory state still updated.
    }
  },

  clear() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // nothing to do — the ratings are already safely in the account
    }
  },
};
