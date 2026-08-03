/**
 * Builds the drink catalog from Open Food Facts.
 *
 *   node scripts/import-catalog.mjs           # use cache where possible
 *   node scripts/import-catalog.mjs --fresh   # ignore cache, re-fetch
 *
 * Writes src/lib/catalog.generated.json.
 *
 * Why a build-time script and not a runtime fetch: OFF's API rate-limits hard
 * (it 503'd repeatedly while this was being written), and the catalog changes
 * about as often as new cans hit shelves. Responses are cached under
 * .cache/off/ so re-runs are free and reviewable.
 *
 * Data: Open Food Facts, Open Database License (ODbL).
 * Images: Open Food Facts contributors, CC BY-SA 3.0. Attribution is required
 * wherever these are displayed — see ATTRIBUTION.md.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE_DIR = join(ROOT, ".cache", "off");
const OUT_FILE = join(ROOT, "src", "lib", "catalog.generated.json");
const FRESH = process.argv.includes("--fresh");

const UA = "Cansensus/0.1 (https://github.com/JosephTLockwood/cansensus)";
const API = "https://world.openfoodfacts.org/api/v2/search";

/**
 * Brands to pull, with how many cans to take from each. Rather than naming
 * individual flavours (which would go stale and reintroduce hand-maintenance),
 * we take the best-documented products per brand — "best" meaning it has a
 * front photo and a real caffeine figure.
 */
const BRANDS = [
  { tag: "red-bull", take: 4, label: "Red Bull" },
  { tag: "monster-energy", take: 6, label: "Monster" },
  { tag: "celsius", take: 6, label: "Celsius" },
  { tag: "alani-nu", take: 5, label: "Alani Nu" },
  { tag: "c4", take: 5, label: "C4" },
  { tag: "bucked-up", take: 4, label: "Bucked Up" },
  { tag: "bang", take: 3, label: "Bang" },
  { tag: "ghost", take: 3, label: "Ghost" },
  { tag: "reign", take: 2, label: "Reign" },
  { tag: "rockstar", take: 3, label: "Rockstar" },
  { tag: "prime", take: 2, label: "Prime" },
  { tag: "nos", take: 1, label: "NOS" },
  { tag: "zoa", take: 2, label: "ZOA" },
  { tag: "guayaki", take: 2, label: "Guayaki Yerba Mate" },
];

const PALETTE = [
  "#D8FF3E", "#FF5B24", "#3EE8FF", "#B77BFF", "#FFC53E", "#FF4D8D",
  "#6BFFA8", "#FF8A3E", "#7FB4FF", "#E8FF7A", "#FF6BD6", "#4DFFD2",
  "#FFD86B", "#9AFF3E", "#FF9B9B", "#5EC8FF",
];

const FIELDS = [
  "code", "product_name", "product_name_en", "brands", "quantity",
  "serving_size", "image_front_url", "image_front_small_url",
  "nutriments", "categories_tags", "labels_tags", "countries_tags",
].join(",");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBrand(brand) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const cacheFile = join(CACHE_DIR, `${brand.tag}.json`);

  if (!FRESH && existsSync(cacheFile)) {
    return JSON.parse(readFileSync(cacheFile, "utf8"));
  }

  const url =
    `${API}?brands_tags=${encodeURIComponent(brand.tag)}` +
    `&categories_tags=energy-drinks&fields=${FIELDS}&page_size=100`;

  // OFF 503s under load; back off and retry rather than losing the brand.
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) {
        const json = await res.json();
        writeFileSync(cacheFile, JSON.stringify(json, null, 2));
        return json;
      }
      console.warn(`  ${brand.tag}: HTTP ${res.status} (attempt ${attempt})`);
    } catch (err) {
      console.warn(`  ${brand.tag}: ${err.message} (attempt ${attempt})`);
    }
    await sleep(attempt * 2500);
  }
  console.warn(`  ${brand.tag}: giving up`);
  return { products: [] };
}

/** "16 fl oz", "250 ml", "473ml" -> millilitres. */
function parseMl(...candidates) {
  for (const raw of candidates) {
    if (!raw) continue;
    const s = String(raw).toLowerCase().replace(",", ".");
    let m = s.match(/([\d.]+)\s*(ml|milliliter|millilitre)/);
    if (m) return parseFloat(m[1]);
    m = s.match(/([\d.]+)\s*(cl)/);
    if (m) return parseFloat(m[1]) * 10;
    m = s.match(/([\d.]+)\s*l\b/);
    if (m) return parseFloat(m[1]) * 1000;
    m = s.match(/([\d.]+)\s*(fl\.?\s*oz|oz)/);
    if (m) return parseFloat(m[1]) * 29.5735;
  }
  return null;
}

/**
 * Nutrient for the whole can. OFF stores per-100 values reliably and
 * per-serving values sometimes; a "serving" is often not the full can, so
 * per-100 x volume is the figure we actually want for a league table.
 */
function perCan(nutriments, key, ml, { gramsToMg = false } = {}) {
  if (!nutriments || !ml) return null;
  const per100 = nutriments[`${key}_100g`] ?? nutriments[key];
  if (typeof per100 !== "number" || Number.isNaN(per100)) return null;
  const total = per100 * (ml / 100);
  return gramsToMg ? total * 1000 : total;
}

/**
 * Caffeine is crowd-entered into a field that expects grams, and contributors
 * routinely type milligrams instead. That produced Celsius cans claiming
 * 710 mg (the real figure is 200 mg) — a 3.5x overstatement of a stimulant
 * dose. Anything outside a physically plausible density is dropped rather than
 * corrected, because we cannot know which way the entry was wrong.
 *
 * Real densities for reference (mg per 100 ml):
 *   Red Bull 32 · Monster 33 · Celsius 56 · Bang 63 · Bucked Up 63
 *   5-hour-style shots run ~350, so small volumes get their own ceiling.
 */
function caffeinePlausible(mg, ml) {
  if (!mg || !ml || mg <= 0) return false;
  const density = (mg / ml) * 100;
  if (ml >= 200) return mg >= 40 && mg <= 400 && density <= 75;
  if (ml >= 100) return mg >= 40 && mg <= 400 && density <= 150;
  return mg >= 40 && mg <= 400 && density <= 700; // shots
}

/**
 * Sugar and calories get the same density sanity check as caffeine, because
 * the same contributor error happens: Red Bull Yellow Edition came through
 * claiming 56,800 kcal for a 355 ml can, which is kJ in a kcal field.
 *
 * Unlike caffeine these are not essential — a can with no calorie figure is
 * still rankable — so an implausible value becomes null rather than dropping
 * the whole product.
 *
 * Ceilings: a soft drink is at most ~20 g sugar per 100 ml, and sugar is 4 kcal
 * per gram, so ~85 kcal per 100 ml is the physical limit.
 */
function sanitise(value, ml, maxPer100) {
  if (value === null || value === undefined || !ml) return null;
  if (value < 0) return null;
  return (value / ml) * 100 > maxPer100 ? null : value;
}

/** Percentile, so a single bad row cannot flatten a whole axis. */
function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)));
  return sorted[i];
}

/** Brand tokens that must keep their casing. */
const ACRONYMS = new Set(["ZOA", "NOS", "XL", "GT", "XS", "BPM", "TNT", "VPX"]);

/**
 * "SPARKLING KIWI GUAVA" / "Cereal killer" -> "Sparkling Kiwi Guava".
 * Every word is capitalised — these are product names, so the usual
 * lowercase-the-minor-words rule reads wrong ("Red Bull the Red Edition",
 * "Pure Zero Fruit Punch sugar Free").
 */
function titleCase(s) {
  return s
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 1) return w.toUpperCase();
      // Keep numbers and known brand acronyms; title-case everything else.
      // A plain "all-caps and short" rule looked right until it produced
      // "Red Bull THE SEA Blue Edition".
      if (/^\d/.test(w) || /^[A-Z]\d/.test(w) || ACRONYMS.has(w)) return w;
      const lower = w.toLowerCase();
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function cleanName(p, brandLabel) {
  let name = (p.product_name_en || p.product_name || "").trim();
  name = name
    .replace(/\s+/g, " ")
    .replace(/energy drink/gi, "")
    .replace(/\bcaffeinated\b/gi, "")
    .replace(/\bflavou?r\b/gi, "")
    .replace(/\bzero sugar\b/gi, "Zero Sugar")
    .replace(/\s*[-–—]\s*$/, "")
    .trim();
  // trailing/leading repetition of the brand: "Bang Krazy Key Lime Pie - Bang"
  const brandRe = new RegExp(`\\s*[-–—,]?\\s*${brandLabel}\\s*$`, "i");
  name = name.replace(brandRe, "").trim();
  name = name.replace(/^[-–—·,]+|[-–—·,]+$/g, "").replace(/\s{2,}/g, " ").trim();
  if (!name) return brandLabel;

  name = titleCase(name);
  const lower = name.toLowerCase();
  const brandLower = brandLabel.toLowerCase();
  // "Monster Energy Zero Sugar" already carries the brand; don't double it
  if (lower.startsWith(brandLower) || lower.startsWith(brandLower.replace(/\s/g, ""))) {
    return name;
  }
  return `${brandLabel} ${name}`;
}

/** Same product in two sizes shouldn't appear twice; strip size/qualifiers. */
function dedupeKey(brandLabel, name) {
  return `${brandLabel}|${name
    .toLowerCase()
    .replace(/\b(zero sugar|zero|sugarfree|sugar free|sparkling|deer)\b/g, "")
    .replace(/[^a-z]/g, "")}`;
}

const isEnergyDrink = (p) =>
  (p.categories_tags ?? []).some((t) => t.includes("energy-drink"));

const isUS = (p) =>
  (p.countries_tags ?? []).some((t) => t === "en:united-states");

async function main() {
  const picked = [];
  const seenNames = new Set();

  for (const brand of BRANDS) {
    const data = await fetchBrand(brand);
    const products = data.products ?? [];

    let rejected = 0;
    const scored = products
      .filter((p) => p.image_front_url && isEnergyDrink(p))
      .map((p) => {
        const ml = parseMl(p.quantity, p.serving_size);
        const caffeineMg = perCan(p.nutriments, "caffeine", ml, {
          gramsToMg: true,
        });
        const sugarG = sanitise(perCan(p.nutriments, "sugars", ml), ml, 20);
        const kcal = sanitise(perCan(p.nutriments, "energy-kcal", ml), ml, 85);
        return { p, ml, caffeineMg, sugarG, kcal, us: isUS(p) };
      })
      // A row without volume or caffeine can't be scored or compared, and
      // guessing either would be inventing data. Drop it.
      .filter((r) => {
        if (!r.ml) return false;
        if (!caffeinePlausible(r.caffeineMg, r.ml)) {
          if (r.caffeineMg) rejected++;
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        // US products first — this is a US league and OFF skews heavily EU
        if (a.us !== b.us) return a.us ? -1 : 1;
        // then the most complete record, then the larger can
        const score = (r) =>
          (r.sugarG !== null ? 2 : 0) + (r.kcal !== null ? 1 : 0);
        return score(b) - score(a) || (b.ml ?? 0) - (a.ml ?? 0);
      });

    let taken = 0;
    for (const r of scored) {
      if (taken >= brand.take) break;
      const name = cleanName(r.p, brand.label);
      const key = dedupeKey(brand.label, name);
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      taken++;

      const oz = r.ml / 29.5735;
      picked.push({
        id: r.p.code,
        barcode: r.p.code,
        name,
        brand: brand.label,
        sub: oz >= 1 ? `${oz.toFixed(1).replace(/\.0$/, "")} oz` : `${Math.round(r.ml)} ml`,
        ml: Math.round(r.ml),
        caf: Math.round(r.caffeineMg),
        sug: r.sugarG === null ? null : Math.round(r.sugarG),
        cal: r.kcal === null ? null : Math.round(r.kcal),
        imageUrl: r.p.image_front_url,
        imageSmallUrl: r.p.image_front_small_url ?? null,
        source: `https://world.openfoodfacts.org/product/${r.p.code}`,
        us: r.us,
      });
    }
    const note = rejected ? `, ${rejected} rejected on implausible caffeine` : "";
    console.log(
      `${brand.label.padEnd(20)} ${taken}/${brand.take} taken (${products.length} candidates${note})`,
    );
    if (!existsSync(join(CACHE_DIR, `${brand.tag}.json`))) await sleep(1200);
  }

  // Flavour-map axes, from real nutrition rather than invented numbers:
  //   x = sugar density, y = caffeine density.
  // Normalised on the 5th/95th percentile, not min/max: one bad row used to
  // stretch the scale so far that every real can collapsed onto one edge.
  const sugarDensity = (d) => (d.sug === null ? null : (d.sug / d.ml) * 100);
  const cafDensity = (d) => (d.caf / d.ml) * 100;

  const axis = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const lo = percentile(sorted, 0.05);
    const hi = percentile(sorted, 0.95);
    return { lo, range: Math.max(hi - lo, 0.0001) };
  };
  const sAxis = axis(picked.map(sugarDensity).filter((v) => v !== null));
  const cAxis = axis(picked.map(cafDensity));
  // 6-96 keeps dots off the very edge of the map; clamp because percentile
  // bounds mean the extremes legitimately fall outside [lo, hi].
  const place = (v, a) =>
    Math.round(Math.min(96, Math.max(6, 6 + ((v - a.lo) / a.range) * 90)));

  const catalog = picked.map((d, i) => {
    const sd = sugarDensity(d);
    return {
      ...d,
      color: PALETTE[i % PALETTE.length],
      sweet: sd === null ? 50 : place(sd, sAxis),
      nuke: place(cafDensity(d), cAxis),
    };
  });

  const out = {
    generatedFrom: "Open Food Facts",
    dataLicense: "Open Database License (ODbL)",
    imageLicense: "CC BY-SA 3.0, Open Food Facts contributors",
    attributionUrl: "https://openfoodfacts.org",
    count: catalog.length,
    drinks: catalog,
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));

  const withSugar = catalog.filter((d) => d.sug !== null).length;
  const withCal = catalog.filter((d) => d.cal !== null).length;
  console.log(
    `\n${catalog.length} cans -> ${OUT_FILE}\n` +
      `  caffeine: ${catalog.length}/${catalog.length}\n` +
      `  sugar:    ${withSugar}/${catalog.length}\n` +
      `  calories: ${withCal}/${catalog.length}\n` +
      `  photos:   ${catalog.filter((d) => d.imageUrl).length}/${catalog.length}`,
  );
}

await main();
