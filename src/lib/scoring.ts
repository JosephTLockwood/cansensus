import { SLIDER_DEFS } from "./data";
import type { Drink, Ratings, Vals } from "./types";

/**
 * Every derived number in the league. Pure functions only — no React, no
 * randomness, no clocks, so the server and the client always agree.
 *
 * The central rule: a score is `number | null`, and null means "nobody has
 * rated this". Callers must render "—", never 0 and never a guess.
 */

export const DEFAULT_VALS: Vals = { taste: 7, kick: 7, after: 6, value: 7 };

/** Weighted composite of one taster's four sliders. */
export function compositeScore(v: Vals): number {
  return SLIDER_DEFS.reduce((a, s) => a + v[s.key] * s.w, 0);
}

/**
 * The score shown for a drink.
 *
 * With no crowd data yet, this is simply your own rating — the table is a
 * personal league table until the backend lands. Once `crowd` is populated,
 * your rating is folded in with the pull of 12 crowd votes: enough that rating
 * a can visibly moves it, not enough to let one person rewrite the table.
 */
export function scoreFor(d: Drink, ratings: Ratings): number | null {
  const mine = ratings[d.id];
  const crowd = d.crowd;
  if (!crowd) return mine ? mine.score : null;
  if (!mine) return crowd.score;
  return (crowd.score * crowd.votes + mine.score * 12) / (crowd.votes + 12);
}

export function votesFor(d: Drink, ratings: Ratings): number {
  return (d.crowd?.votes ?? 0) + (ratings[d.id] ? 1 : 0);
}

/** Rated drinks first, best score down; unrated keep catalog order behind them. */
export function ranked(list: Drink[], ratings: Ratings): Drink[] {
  return [...list].sort((a, b) => {
    const x = scoreFor(a, ratings);
    const y = scoreFor(b, ratings);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return y - x;
  });
}

/**
 * id -> league position, 1-based. Only scored drinks get a position; unrated
 * ones are absent, so the table shows "—" instead of implying a ranking.
 *
 * Takes the drink list rather than importing it: the catalog is live now, so a
 * module-level constant would silently ignore submitted cans.
 */
export function rankMap(
  drinks: Drink[],
  ratings: Ratings,
): Record<string, number> {
  const out: Record<string, number> = {};
  let position = 0;
  for (const d of ranked(drinks, ratings)) {
    if (scoreFor(d, ratings) === null) continue;
    out[d.id] = ++position;
  }
  return out;
}

/** id -> position at the last weekly snapshot. Empty until snapshots exist. */
export function prevRankMap(drinks: Drink[]): Record<string, number> {
  const out: Record<string, number> = {};
  drinks
    .filter((d) => d.crowd?.prevScore != null)
    .sort((a, b) => (b.crowd!.prevScore ?? 0) - (a.crowd!.prevScore ?? 0))
    .forEach((d, i) => {
      out[d.id] = i + 1;
    });
  return out;
}

/**
 * Real weekly scores for a drink, oldest first. Empty until the backend starts
 * writing snapshots — the prototype synthesised this curve from a sine wobble,
 * which is exactly the kind of invented data this rewrite removes.
 */
export function history(): number[] {
  return [];
}

/** History as an SVG `points` string for a 140x44 viewBox, or null if none. */
export function sparkline(points: number[]): string | null {
  if (points.length < 2) return null;
  const lo = Math.min(...points) - 0.2;
  const hi = Math.max(...points) + 0.2;
  const step = 140 / (points.length - 1);
  return points
    .map(
      (y, i) =>
        `${(i * step).toFixed(1)},${(40 - ((y - lo) / (hi - lo)) * 36).toFixed(1)}`,
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

/** Mean over the items that have a value; null when none do. */
export function averageOf<T>(
  list: T[],
  f: (item: T) => number | null,
): number | null {
  const values = list.map(f).filter((v): v is number => v !== null);
  if (!values.length) return null;
  return values.reduce((a, v) => a + v, 0) / values.length;
}

/** Caffeine mg per 100 ml — the honest "intensity" measure. */
export function caffeineDensity(d: Drink): number {
  return (d.caf / d.ml) * 100;
}

/** Maps a 5-9.5 score onto a 4-100% bar width, so differences stay legible. */
export function barPercent(score: number): number {
  return Math.max(4, Math.round(((score - 5) / 4.5) * 100));
}

/** Formats a nullable score for display. */
export function fmtScore(score: number | null): string {
  return score === null ? "—" : score.toFixed(2);
}
