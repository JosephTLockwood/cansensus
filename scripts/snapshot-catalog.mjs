/**
 * Captures the live catalog into src/lib/catalog.generated.json.
 *
 *   npm run snapshot
 *
 * This is the first paint. The app reads the real catalog from Postgres at
 * runtime, but that takes a round trip, so the page is server-rendered from this
 * snapshot and then swaps in live rows. Keeping the snapshot in step with the
 * database is what stops the table visibly jumping from one set of cans to
 * another on load.
 *
 * Division of labour, after the catalog moved into Postgres:
 *   import-catalog.mjs   Open Food Facts -> supabase/seed.sql   (seeding)
 *   snapshot-catalog.mjs Postgres        -> catalog.generated.json (first paint)
 *
 * Uses the publishable key only: `drinks` is publicly readable by design, so
 * this needs no secret.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "lib", "catalog.generated.json");

/** Read NEXT_PUBLIC_* values from .env.local without pulling in a dep. */
function envLocal() {
  const out = {};
  try {
    for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].trim();
    }
  } catch {
    /* fall through to process.env */
  }
  return out;
}

const env = { ...envLocal(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\n" +
      "(from .env.local or the environment).",
  );
  process.exit(1);
}

const res = await fetch(
  `${url}/rest/v1/drinks?select=id,barcode,name,brand,sub,ml,caf,sug,cal,sweet,nuke,color,image_url,image_small_url,photo_url,source,us&status=eq.live&order=brand,name`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
);

if (!res.ok) {
  console.error("read failed:", res.status, (await res.text()).slice(0, 300));
  process.exit(1);
}

const rows = await res.json();

const drinks = rows.map((r) => ({
  id: r.id,
  barcode: r.barcode ?? r.id,
  name: r.name,
  brand: r.brand,
  sub: r.sub,
  ml: r.ml,
  caf: r.caf,
  sug: r.sug === null ? null : Number(r.sug),
  cal: r.cal,
  sweet: r.sweet,
  nuke: r.nuke,
  color: r.color,
  imageUrl: r.image_url ?? "",
  imageSmallUrl: r.image_small_url,
  photoUrl: r.photo_url ?? null,
  source: r.source ?? "",
  us: r.us,
}));

writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedFrom: "Cansensus database (see scripts/snapshot-catalog.mjs)",
      dataLicense: "Open Database License (ODbL) for Open Food Facts sourced rows",
      imageLicense: "CC BY-SA 3.0, Open Food Facts contributors",
      attributionUrl: "https://openfoodfacts.org",
      count: drinks.length,
      drinks,
    },
    null,
    2,
  ),
);

console.log(`${drinks.length} cans -> ${OUT}`);
for (const d of drinks) console.log(`  ${d.name} (${d.sub}, ${d.caf} mg)`);
