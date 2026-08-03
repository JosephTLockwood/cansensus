import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Submit a can that isn't in the catalog.
 *
 * Everything comes off the label the submitter is holding. There is no barcode
 * lookup: reading the can is more reliable than hoping a crowd-maintained
 * database has it, and Open Food Facts turned out not to carry the store brands
 * this is most needed for.
 *
 * Why this is a server route rather than a direct insert from the browser: the
 * validation below has to happen somewhere the submitter cannot skip it.
 * `drinks` has no client INSERT policy at all — this route holds the secret key
 * and is the only way in.
 *
 * Anything a signed-in user submits goes live immediately; being signed in is
 * the only gate. That puts all the weight on two things:
 *
 *   1. Caffeine plausibility, because this is health information and a typo of
 *      "2000" for "200" must not reach the page.
 *   2. Duplicate detection. Dropping the barcode removed the one exact identity
 *      a can had, so the name match has to be forgiving enough to catch
 *      "Monster Ultra" against "Monster Energy Ultra".
 */

const PALETTE = [
  "#D8FF3E", "#FF5B24", "#3EE8FF", "#B77BFF", "#FFC53E", "#FF4D8D",
  "#6BFFA8", "#FF8A3E", "#7FB4FF", "#E8FF7A", "#FF6BD6", "#4DFFD2",
  "#FFD86B", "#9AFF3E", "#FF9B9B", "#5EC8FF",
];

type Body = {
  name?: unknown;
  brand?: unknown;
  ml?: unknown;
  caf?: unknown;
  sug?: unknown;
  cal?: unknown;
  /** Storage path in the can-photos bucket, e.g. "<uid>/<uuid>.jpg". */
  photoPath?: unknown;
};

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length ? v.trim().slice(0, max) : null;

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * Physically plausible caffeine for a given volume. Mirrors the check in
 * scripts/import-catalog.mjs, and exists for the same reason either way: an
 * untrusted source overstating a stimulant dose.
 */
function caffeinePlausible(mg: number, ml: number) {
  const density = (mg / ml) * 100;
  if (ml >= 200) return mg >= 40 && mg <= 400 && density <= 75;
  if (ml >= 100) return mg >= 40 && mg <= 400 && density <= 150;
  return mg >= 40 && mg <= 400 && density <= 700; // shots
}

const ACRONYMS = new Set(["ZOA", "NOS", "XL", "GT", "XS", "BPM", "TNT", "VPX"]);

function titleCase(s: string) {
  return s
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 1) return w.toUpperCase();
      if (/^\d/.test(w) || /^[A-Z]\d/.test(w) || ACRONYMS.has(w)) return w;
      const lower = w.toLowerCase();
      return lower[0].toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Prefix the brand when the flavour name doesn't already carry it. */
function displayName(rawName: string, brand: string) {
  const name = titleCase(rawName.replace(/\s+/g, " ").trim()) || brand;
  const lower = name.toLowerCase();
  const b = brand.toLowerCase();
  if (lower.startsWith(b) || lower.startsWith(b.replace(/\s/g, ""))) return name;
  return `${brand} ${name}`;
}

/**
 * Words carrying no distinguishing information on an energy drink, so two names
 * differing only by these describe the same can.
 */
const FILLER = new Set([
  "energy", "drink", "the", "a", "and", "of", "with",
  "zero", "sugar", "sugarfree", "free", "flavor", "flavour", "can",
]);

/**
 * Comparable identity for a can: the set of meaningful words across its brand
 * and name, order-insensitive.
 *
 * Compares sets for EQUALITY rather than checking subsets on purpose. Subset
 * matching would fold "Celsius Orange Cream" into "Celsius Orange" and block a
 * genuinely different flavour — worse than letting the occasional duplicate in.
 */
function identity(brand: string, name: string): string {
  const words = `${brand} ${name}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w));
  return [...new Set(words)].sort().join(" ");
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  const supabase = admin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Submissions are not configured on this deployment." },
      { status: 503 },
    );
  }

  // Identify the caller from their own bearer token. The secret key does the
  // write, but only after establishing who is asking.
  const token = (request.headers.get("authorization") ?? "").replace(
    /^Bearer\s+/i,
    "",
  );
  if (!token) {
    return NextResponse.json({ error: "Sign in to add a can." }, { status: 401 });
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Pick a handle before adding a can." },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  // The photo is uploaded straight to storage by the browser (storage RLS
  // confines it to the user's own folder) and only its path is sent here.
  // Re-check the prefix rather than trusting it — accepting an arbitrary path
  // would let a submission claim someone else's image.
  const rawPhoto = str(body.photoPath, 300);
  let photoUrl: string | null = null;
  if (rawPhoto) {
    if (!rawPhoto.startsWith(`${user.id}/`)) {
      return NextResponse.json(
        { error: "That photo does not belong to you." },
        { status: 403 },
      );
    }
    photoUrl =
      supabase.storage.from("can-photos").getPublicUrl(rawPhoto).data
        ?.publicUrl ?? null;
  }

  // --- everything off the label ---
  const rawBrand = str(body.brand, 80);
  const brand = rawBrand ? titleCase(rawBrand) : null;
  const rawName = str(body.name, 120);
  const name = rawName && brand ? displayName(rawName, brand) : rawName;
  const ml = num(body.ml);
  const caf = num(body.caf);

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Give the can a name." }, { status: 400 });
  }
  if (!brand) {
    return NextResponse.json({ error: "Which brand is it?" }, { status: 400 });
  }
  if (!ml || ml < 15 || ml > 2000) {
    return NextResponse.json(
      { error: "Size looks wrong — give the volume in oz or ml." },
      { status: 400 },
    );
  }
  if (caf === null || !caffeinePlausible(caf, ml)) {
    return NextResponse.json(
      {
        error:
          "Caffeine looks implausible for that size. Check the label — it should be 40–400 mg per can.",
      },
      { status: 400 },
    );
  }

  // Optional, and only kept when physically possible: ~20 g sugar and ~85 kcal
  // per 100 ml are the ceilings for a soft drink.
  const rawSug = num(body.sug);
  const rawCal = num(body.cal);
  const sug =
    rawSug !== null && rawSug >= 0 && (rawSug / ml) * 100 <= 20
      ? Math.round(rawSug)
      : null;
  const cal =
    rawCal !== null && rawCal >= 0 && (rawCal / ml) * 100 <= 85
      ? Math.round(rawCal)
      : null;

  const oz = ml / 29.5735;
  const key = identity(brand, name);

  // --- one entry per person per can ---
  //
  // A clash belonging to this submitter updates their entry; a clash belonging
  // to anyone else (or to a seeded row, where submitted_by is null) is a
  // rejection. These must stay a single lookup — checking them separately made
  // resubmitting your own can fail as a duplicate instead of updating it.
  const { data: allDrinks } = await supabase
    .from("drinks")
    .select("id, name, brand, submitted_by");

  const existing =
    (allDrinks ?? []).find((d) => identity(d.brand, d.name) === key) ?? null;

  const id = existing?.id ?? `user:${crypto.randomUUID()}`;
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  const row = {
    name,
    brand,
    sub:
      oz >= 1 ? `${oz.toFixed(1).replace(/\.0$/, "")} oz` : `${Math.round(ml)} ml`,
    ml: Math.round(ml),
    caf: Math.round(caf),
    sug,
    cal,
    // Placed from real nutrition where we have it; mid-axis when sugar is unknown.
    sweet:
      sug === null
        ? 50
        : Math.min(96, Math.max(6, Math.round((sug / ml) * 100 * 6))),
    nuke: Math.min(96, Math.max(6, Math.round(((caf / ml) * 100 - 25) * 2.2))),
    color: PALETTE[hash % PALETTE.length],
    photo_url: photoUrl,
    photo_by: photoUrl ? profile.id : null,
    us: true,
    status: "live",
  };

  if (existing) {
    if (existing.submitted_by !== profile.id) {
      return NextResponse.json(
        {
          error: `${existing.name} is already in the catalog. Search for it instead of adding it again.`,
        },
        { status: 409 },
      );
    }
    // Their own entry — replace it. Omitting photo_url when no new photo was
    // attached means editing the details doesn't silently drop the picture.
    const update: Record<string, unknown> = { ...row };
    if (!photoUrl) {
      delete update.photo_url;
      delete update.photo_by;
    }
    const { error } = await supabase
      .from("drinks")
      .update(update)
      .eq("id", existing.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({
      id: existing.id,
      name: row.name,
      updated: true,
      message: `Updated your entry for ${row.name}.`,
    });
  }

  const { error } = await supabase
    .from("drinks")
    .insert({ ...row, id, submitted_by: profile.id })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    id,
    name: row.name,
    updated: false,
    message: `${row.name} added to the catalog.`,
  });
}
