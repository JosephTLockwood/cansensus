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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void source.load().then((loadedRatings) => {
      if (!active) return;
      setRatings(loadedRatings);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [source]);

  const rate = useCallback(
    (drinkId: string, rating: Rating) => {
      setRatings((prev) => ({ ...prev, [drinkId]: rating }));
      void source.save(drinkId, rating);
    },
    [source],
  );

  return { ratings, loaded, rate };
}
