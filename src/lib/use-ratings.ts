"use client";

import { useCallback, useEffect, useState } from "react";
import { localRatingsSource, type RatingsSource } from "./ratings-source";
import type { Rating, Ratings } from "./types";

/**
 * Holds the current user's ratings and writes them through to a
 * {@link RatingsSource}.
 *
 * Updates are optimistic: state changes immediately, the write is fired off
 * and not awaited. That is right for localStorage and stays right for an API
 * (the table should move the instant you hit submit). When the source is a
 * network call, this is where a rollback-on-failure would go.
 */
export function useRatings(source: RatingsSource = localRatingsSource) {
  const [ratings, setRatings] = useState<Ratings>({});
  /** Which source the current `ratings` came from. */
  const [loadedFrom, setLoadedFrom] = useState<RatingsSource | null>(null);

  // Derived rather than a second piece of state, so swapping source (signing
  // in) reports "not loaded" without setting state during the effect body.
  const loaded = loadedFrom === source;

  useEffect(() => {
    let active = true;
    void source.load().then((loadedRatings) => {
      if (!active) return;
      setRatings(loadedRatings);
      setLoadedFrom(source);
    });
    return () => {
      active = false;
    };
  }, [source]);

  /** Re-read from the source — used after migrating pre-signup ratings. */
  const reload = useCallback(async () => {
    const fresh = await source.load();
    setRatings(fresh);
  }, [source]);

  const rate = useCallback(
    (drinkId: string, rating: Rating) => {
      setRatings((prev) => ({ ...prev, [drinkId]: rating }));
      void source.save(drinkId, rating);
    },
    [source],
  );

  return { ratings, loaded, rate, reload };
}
