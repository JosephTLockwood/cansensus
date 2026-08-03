import catalog from "./catalog.generated.json";
import type { ColDef, Drink, FilterDef, SliderDef } from "./types";

/**
 * The catalog comes from Open Food Facts via `npm run import:catalog`
 * (scripts/import-catalog.mjs). Do not hand-edit catalog.generated.json —
 * regenerate it. See ATTRIBUTION.md for the licence terms.
 *
 * What is deliberately NOT here: crowd scores, vote counts, weekly history and
 * prices. Those were invented in the original prototype. They now arrive from
 * the backend (docs/BACKEND.md) or from user submissions, and until then the UI
 * shows "—" rather than a number nobody measured.
 */

type RawDrink = (typeof catalog.drinks)[number];

export const DRINKS: Drink[] = (catalog.drinks as RawDrink[]).map((d) => ({
  ...d,
  sug: d.sug ?? null,
  cal: d.cal ?? null,
  imageSmallUrl: d.imageSmallUrl ?? null,
  photoUrl: null,
  price: null,
  crowd: null,
}));

export const CATALOG_META = {
  source: catalog.generatedFrom,
  dataLicense: catalog.dataLicense,
  imageLicense: catalog.imageLicense,
  attributionUrl: catalog.attributionUrl,
};

/**
 * Avatar colours. Same set the cans use, kept here rather than imported from the
 * generated catalog so a handle's colour never depends on what is in stock.
 */
const AVATAR_PALETTE = [
  "#D8FF3E", "#FF5B24", "#3EE8FF", "#B77BFF", "#FFC53E", "#FF4D8D",
  "#6BFFA8", "#FF8A3E", "#7FB4FF", "#E8FF7A", "#FF6BD6", "#4DFFD2",
  "#FFD86B", "#9AFF3E", "#FF9B9B", "#5EC8FF",
];

/** Stable avatar colour for a handle, so it doesn't change between renders. */
export function PALETTE_FOR_HANDLE(handle: string): string {
  let hash = 0;
  for (const ch of handle) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

/** Descriptive chips, derived from the real nutrition panel. */
export function tagsFor(d: Drink): string[] {
  const tags: string[] = [];
  if (d.sug === 0) tags.push("zero sugar");
  else if (d.sug !== null && d.sug >= 40) tags.push("high sugar");
  if (d.caf >= 250) tags.push("extreme caffeine");
  else if (d.caf >= 180) tags.push("high caffeine");
  if (d.ml >= 470) tags.push("big can");
  if (d.ml <= 100) tags.push("shot");
  if (!d.us) tags.push("import");
  return tags;
}

/** The four axes a taster scores, and their weight in the composite. */
export const SLIDER_DEFS: SliderDef[] = [
  { key: "taste", label: "Taste", hint: "does it slap", w: 0.38 },
  { key: "kick", label: "Kick", hint: "does it work", w: 0.28 },
  { key: "after", label: "Aftertaste", hint: "the 20-minute problem", w: 0.2 },
  { key: "value", label: "Value", hint: "per dollar", w: 0.14 },
];

/* The "Under $2.60" filter is gone with prices — it cannot be evaluated. */
export const FILTERS: FilterDef[] = [
  { key: "zero", label: "Zero sugar", test: (d) => d.sug === 0 },
  { key: "sugar", label: "Full sugar", test: (d) => d.sug !== null && d.sug > 0 },
  { key: "high", label: "200mg+", test: (d) => d.caf >= 200 },
  { key: "big", label: "Big can", test: (d) => d.ml >= 470 },
  { key: "mine", label: "Rated by me", test: (d, ratings) => !!ratings[d.id] },
];

/* "mg / $" is gone with prices. Δ wk stays: it renders "—" until weekly
   snapshots exist, and lights up unchanged once they do. */
export const COLS: ColDef[] = [
  { key: "rank", label: "#", align: "left" },
  { key: "name", label: "Drink", align: "left" },
  { key: "score", label: "Score", align: "left" },
  { key: "votes", label: "Votes", align: "right", ext: true },
  { key: "caf", label: "Caffeine", align: "right", ext: true },
  { key: "sug", label: "Sugar", align: "right", ext: true },
  { key: "delta", label: "Δ wk", align: "right" },
];

/** Caffeine dose bands used by the lab section. */
export const CAFFEINE_BANDS: [number, number, string][] = [
  [0, 120, "Under 120 mg"],
  [120, 180, "120–179 mg"],
  [180, 220, "180–219 mg"],
  [220, 400, "220 mg+"],
];

export const SEASON = 1;
export const WEEK = 1;
