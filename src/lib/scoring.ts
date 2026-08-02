import { DRINKS, SLIDER_DEFS } from "./data";
import type { Drink, Ratings, Vals } from "./types";

/**
 * Every derived number in the league. Pure functions only — no React, no
 * randomness, no clocks, so the server and the client always agree.
 */

export const DEFAULT_VALS: Vals = { taste: 7, kick: 7, after: 6, value: 7 };

/** Weighted composite of one taster's four sliders. */
export function compositeScore(v: Vals): number {
  return SLIDER_DEFS.reduce((a, s) => a + v[s.key] * s.w, 0);
}

/**
 * The crowd score with the current user's rating folded in.
 *
 * Your single rating is given the pull of 12 crowd votes: enough that rating a
 * can visibly moves it, not enough to let one person rewrite the table.
 */
export function blended(d: Drink, ratings: Ratings): number {
  const mine = ratings[d.id];
  if (!mine) return d.s;
  return (d.s * d.v + mine.score * 12) / (d.v + 12);
}

/** Drinks sorted by blended score, best first. */
export function ranked(list: Drink[], ratings: Ratings): Drink[] {
  return [...list].sort((a, b) => blended(b, ratings) - blended(a, ratings));
}

/** id -> current league position (1-based). */
export function rankMap(ratings: Ratings): Record<string, number> {
  const out: Record<string, number> = {};
  ranked(DRINKS, ratings).forEach((d, i) => {
    out[d.id] = i + 1;
  });
  return out;
}

/** id -> last week's league position (1-based), from the stored `prev` score. */
export function prevRankMap(): Record<string, number> {
  const out: Record<string, number> = {};
  [...DRINKS]
    .sort((a, b) => b.prev - a.prev)
    .forEach((d, i) => {
      out[d.id] = i + 1;
    });
  return out;
}

/**
 * Eight synthetic weekly scores, interpolating `prev` -> live score with a
 * deterministic wobble keyed off the can's own nutrition numbers.
 *
 * Placeholder until the backend stores real weekly snapshots — see
 * `drink_weekly_scores` in docs/BACKEND.md.
 */
export function history(d: Drink, ratings: Ratings): number[] {
  const now = blended(d, ratings);
  const out: number[] = [];
  for (let i = 0; i < 8; i++) {
    const t = i / 7;
    const wobble =
      Math.sin(i * 1.7 + d.caf) * 0.16 + Math.cos(i * 2.3 + d.sug) * 0.1;
    out.push(d.prev + (now - d.prev) * t + wobble * (1 - t * 0.5));
  }
  out[7] = now;
  return out;
}

/** History as an SVG `points` string for a 140x44 viewBox. */
export function sparkline(d: Drink, ratings: Ratings): string {
  const h = history(d, ratings);
  const lo = Math.min(...h) - 0.2;
  const hi = Math.max(...h) + 0.2;
  return h
    .map(
      (y, i) =>
        `${((i * 140) / 7).toFixed(1)},${(40 - ((y - lo) / (hi - lo)) * 36).toFixed(1)}`,
    )
    .join(" ");
}

/** Upper bound (exclusive) -> label. */
const VERDICTS: [number, string][] = [
  [4, "a genuine crime"],
  [5.5, "not for me"],
  [6.5, "it exists"],
  [7.5, "solid rotation"],
  [8.5, "top shelf"],
  [9.4, "elite tier"],
  [11, "perfection, apparently"],
];

export function verdictFor(score: number): string {
  return (VERDICTS.find((v) => score < v[0]) ?? VERDICTS[VERDICTS.length - 1])[1];
}

export function average<T>(list: T[], f: (item: T) => number): number {
  return list.length ? list.reduce((a, item) => a + f(item), 0) / list.length : 0;
}

/** Maps a 5-9.5 score onto a 4-100% bar width, so differences stay legible. */
export function barPercent(score: number): number {
  return Math.max(4, Math.round(((score - 5) / 4.5) * 100));
}
