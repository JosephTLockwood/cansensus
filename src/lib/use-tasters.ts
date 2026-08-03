"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "./supabase/client";
import type { Ratings } from "./types";

export type Taster = {
  id: string;
  handle: string;
  ratedCount: number;
};

export type TasteTwin = {
  handle: string;
  /** 0-100. Not meaningful on a small overlap — always show `shared` with it. */
  match: number;
  /** How many cans you have both rated. */
  shared: number;
  ratedCount: number;
};

type StatsRow = { id: string; handle: string; rated_count: number };
type RatingRow = { user_id: string; drink_id: string; score: number | string };

/**
 * The leaderboard and taste twin, from real accounts.
 *
 * Both read from tables that are publicly readable by design — the whole point
 * of the section is comparing your scores against other people's, and a handle
 * carries no personal information.
 *
 * The twin is computed from actual overlapping ratings rather than a similarity
 * of stated preferences. The prototype matched you against invented profiles;
 * this compares the scores two people gave the same cans, and reports how many
 * cans that was so a 97% match off one shared can can't be mistaken for
 * confidence.
 */
export function useTasters(myRatings: Ratings, myUserId: string | undefined) {
  const [tasters, setTasters] = useState<Taster[]>([]);
  const [twin, setTwin] = useState<TasteTwin | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const [{ data: stats }, { data: allRatings }] = await Promise.all([
      supabase
        .from("taster_stats")
        .select("id, handle, rated_count")
        .order("rated_count", { ascending: false }),
      supabase.from("ratings").select("user_id, drink_id, score"),
    ]);

    if (stats) {
      setTasters(
        (stats as StatsRow[]).map((s) => ({
          id: s.id,
          handle: s.handle,
          ratedCount: Number(s.rated_count),
        })),
      );
    }

    // --- taste twin ---
    const mine = Object.entries(myRatings);
    if (!myUserId || mine.length === 0 || !allRatings || !stats) {
      setTwin(null);
      setLoaded(true);
      return;
    }

    const myScores = new Map(mine.map(([id, r]) => [id, r.score]));
    const byUser = new Map<string, Map<string, number>>();
    for (const r of allRatings as RatingRow[]) {
      if (r.user_id === myUserId) continue;
      if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Map());
      byUser.get(r.user_id)!.set(r.drink_id, Number(r.score));
    }

    let best: TasteTwin | null = null;
    for (const [userId, theirs] of byUser) {
      let diff = 0;
      let shared = 0;
      for (const [drinkId, theirScore] of theirs) {
        const myScore = myScores.get(drinkId);
        if (myScore === undefined) continue;
        diff += Math.abs(myScore - theirScore);
        shared++;
      }
      if (shared === 0) continue;
      // A 1-point average gap costs 10 points of match.
      const match = Math.max(0, Math.round(100 - (diff / shared) * 10));
      const profile = (stats as StatsRow[]).find((s) => s.id === userId);
      if (!profile) continue;
      if (!best || match > best.match) {
        best = {
          handle: profile.handle,
          match,
          shared,
          ratedCount: Number(profile.rated_count),
        };
      }
    }
    setTwin(best);
    setLoaded(true);
  }, [myRatings, myUserId]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!active) return;
      await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  return { tasters, twin, loaded };
}
