import type { SupabaseClient } from "@supabase/supabase-js";
import type { RatingsSource } from "./ratings-source";
import { localRatingsSource } from "./ratings-source";
import type { Rating, Ratings, Vals } from "./types";

/**
 * Ratings stored in Postgres, for a signed-in user.
 *
 * This is the implementation the RatingsSource interface existed for — no
 * component changes were needed to swap it in.
 *
 * Note what is NOT sent: the composite score. A BEFORE trigger recomputes it
 * from the four sliders on every write, so sending it would be pointless and
 * trusting it would be a hole. We send the sliders and read the score back.
 */
export function createSupabaseRatingsSource(
  supabase: SupabaseClient,
  userId: string,
): RatingsSource {
  return {
    async load() {
      const { data, error } = await supabase
        .from("ratings")
        .select("drink_id, taste, kick, aftertaste, value, score")
        .eq("user_id", userId);

      if (error || !data) return {};

      const out: Ratings = {};
      for (const row of data) {
        out[row.drink_id as string] = {
          vals: {
            taste: row.taste as number,
            kick: row.kick as number,
            after: row.aftertaste as number,
            value: row.value as number,
          },
          score: Number(row.score),
        };
      }
      return out;
    },

    async save(drinkId, rating) {
      const { error } = await supabase.from("ratings").upsert(
        {
          user_id: userId,
          drink_id: drinkId,
          taste: rating.vals.taste,
          kick: rating.vals.kick,
          aftertaste: rating.vals.after,
          value: rating.vals.value,
          // score omitted on purpose — the database computes it
        },
        { onConflict: "user_id,drink_id" },
      );
      if (error) throw new Error(error.message);
    },
  };
}

/**
 * Moves ratings made before signing in into the account, once, then clears the
 * local copy.
 *
 * Without this, anyone who used the site early is silently punished for having
 * shown up before there were accounts. Existing server rows win — the account
 * is the source of truth if the same can was rated in both places.
 */
export async function migrateLocalRatings(
  target: RatingsSource,
): Promise<number> {
  const local = await localRatingsSource.load();
  const ids = Object.keys(local);
  if (!ids.length) return 0;

  const existing = await target.load();
  let moved = 0;

  for (const id of ids) {
    if (existing[id]) continue;
    try {
      await target.save(id, local[id] as Rating);
      moved++;
    } catch {
      // A can that no longer exists in the catalog will fail the foreign key.
      // Skip it rather than aborting the whole migration.
    }
  }

  if (moved > 0) localRatingsSource.clear?.();
  return moved;
}

/** Recompute a composite the same way the database trigger does. */
export function compositeFromVals(vals: Vals): number {
  return (
    Math.round(
      (vals.taste * 0.38 +
        vals.kick * 0.28 +
        vals.after * 0.2 +
        vals.value * 0.14) *
        100,
    ) / 100
  );
}
