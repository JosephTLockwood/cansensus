/**
 * Crowd aggregates for one drink. Absent until the backend exists — see
 * docs/BACKEND.md. Nothing in the UI may invent these.
 */
export type CrowdStats = {
  /** mean of all users' composite scores, 0-10 */
  score: number;
  votes: number;
  /** standard deviation of ratings — how divisive the can is */
  sd: number;
  /** score at the last weekly snapshot, for the Δ column and form guide */
  prevScore: number | null;
};

/** A can in the league. Sourced from Open Food Facts; see ATTRIBUTION.md. */
export type Drink = {
  /** the barcode, which is also the Open Food Facts key */
  id: string;
  barcode: string;
  name: string;
  brand: string;
  /** serving size for display, e.g. "16 oz" */
  sub: string;
  /** volume in millilitres, used for every per-can derivation */
  ml: number;
  /** caffeine in mg per can. Validated for plausibility at import. */
  caf: number;
  /** sugar in g per can. null when Open Food Facts has no value — render "—". */
  sug: number | null;
  /** calories per can. null when unknown. */
  cal: number | null;
  /** flavour-map x axis, 0-100, from sugar density */
  sweet: number;
  /** flavour-map y axis, 0-100, from caffeine density */
  nuke: number;
  color: string;
  imageUrl: string;
  imageSmallUrl: string | null;
  /** link back to the Open Food Facts product page */
  source: string;
  /** true when the record is listed for the United States */
  us: boolean;
  /** Not sourced — Open Food Facts carries no prices. User-submitted later. */
  price: number | null;
  /** Absent until the backend lands. */
  crowd: CrowdStats | null;
};

export type SliderKey = "taste" | "kick" | "after" | "value";

/** The four 1-10 scores a taster gives a can. */
export type Vals = Record<SliderKey, number>;

/** One user's rating of one can. */
export type Rating = {
  vals: Vals;
  /** weighted composite of `vals`, 0-10 */
  score: number;
};

/** All of the current user's ratings, keyed by drink id. */
export type Ratings = Record<string, Rating>;

export type SliderDef = {
  key: SliderKey;
  label: string;
  hint: string;
  /** weight in the composite score; the four weights sum to 1 */
  w: number;
};

export type FilterDef = {
  key: string;
  label: string;
  test: (d: Drink, ratings: Ratings) => boolean;
};

export type SortKey = "rank" | "name" | "score" | "votes" | "caf" | "sug" | "delta";

export type ColDef = {
  key: SortKey;
  label: string;
  align: "left" | "right";
  /** true for the columns that collapse out on narrow screens */
  ext?: boolean;
};
