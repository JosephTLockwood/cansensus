/** A can in the league. `s`/`prev`/`v` are the crowd-side aggregates. */
export type Drink = {
  id: string;
  name: string;
  /** serving size, e.g. "16 oz" */
  sub: string;
  /** caffeine, mg */
  caf: number;
  /** sugar, g */
  sug: number;
  /** calories */
  cal: number;
  /** street price, USD */
  price: number;
  /** flavour-map x axis: 0 = tart, 100 = sweet */
  sweet: number;
  /** flavour-map y axis: 0 = mild, 100 = nuclear */
  nuke: number;
  /** current crowd score, 0-10 */
  s: number;
  /** crowd score one week ago */
  prev: number;
  /** number of crowd ratings */
  v: number;
  /** standard deviation of ratings — how divisive the can is */
  sd: number;
  tags: string[];
  note: string;
  /** assigned from the palette at load time */
  color: string;
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

export type Person = {
  name: string;
  count: number;
  streak: string;
  badge: string;
  /** preferred sweetness, same scale as Drink.sweet */
  sweetPref: number;
  /** preferred intensity, same scale as Drink.nuke */
  nukePref: number;
};

export type FilterDef = {
  key: string;
  label: string;
  test: (d: Drink, ratings: Ratings) => boolean;
};

export type SortKey =
  | "rank"
  | "name"
  | "score"
  | "votes"
  | "caf"
  | "sug"
  | "ppd"
  | "delta";

export type ColDef = {
  key: SortKey;
  label: string;
  align: "left" | "right";
  /** true for the nutrition columns that collapse out on narrow screens */
  ext?: boolean;
};
