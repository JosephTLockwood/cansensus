import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/**
 * Submit a can that isn't in the catalog.
 *
 * Why this is a server route rather than a direct insert from the browser:
 * deciding whether a submission goes live or into the queue depends on whether
 * Open Food Facts corroborates it, and that decision has to be made somewhere
 * the submitter cannot influence. A browser insert could set status itself, so
 * `drinks` has no client INSERT policy at all — this route holds the secret key
 * and is the only way in.
 *
 * Flow:
 *   barcode given  -> look it up in Open Food Facts
 *     found + plausible -> live immediately, with OFF's nutrition and photo
 *     not found         -> queued with the user's own figures
 *   no barcode     -> queued
 *
 * Everything the user typed is re-validated here. The same caffeine bounds the
 * importer applies are enforced, because a submission is just another untrusted
 * source of health information.
 */

const OFF_UA = "EnergyLeague/0.1 (https://github.com/JosephTLockwood/energy-league)";

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
  barcode?: unknown;
};

const str = (v: unknown, max: number) =>
  typeof v === "string" && v.trim().length ? v.trim().slice(0, max) : null;

const num = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Mirrors caffeinePlausible() in scripts/import-catalog.mjs. */
function caffeinePlausible(mg: number, ml: number) {
  const density = (mg / ml) * 100;
  if (ml >= 200) return mg >= 40 && mg <= 400 && density <= 75;
  if (ml >= 100) return mg >= 40 && mg <= 400 && density <= 150;
  return mg >= 40 && mg <= 400 && density <= 700;
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false } });
}

/** Ask Open Food Facts about a barcode. Never throws — a lookup failure just
 *  means the submission gets queued instead of auto-approved. */
async function lookupBarcode(barcode: string) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}` +
        `?fields=code,product_name,product_name_en,brands,quantity,serving_size,image_front_url,image_front_small_url,nutriments,countries_tags`,
      { headers: { "User-Agent": OFF_UA }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.product ?? null;
  } catch {
    return null;
  }
}

function parseMl(...candidates: unknown[]) {
  for (const raw of candidates) {
    if (!raw) continue;
    const s = String(raw).toLowerCase().replace(",", ".");
    let m = s.match(/([\d.]+)\s*(ml|milliliter|millilitre)/);
    if (m) return parseFloat(m[1]);
    m = s.match(/([\d.]+)\s*cl/);
    if (m) return parseFloat(m[1]) * 10;
    m = s.match(/([\d.]+)\s*l\b/);
    if (m) return parseFloat(m[1]) * 1000;
    m = s.match(/([\d.]+)\s*(fl\.?\s*oz|oz)/);
    if (m) return parseFloat(m[1]) * 29.5735;
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = admin();
  if (!supabase) {
    return NextResponse.json(
      { error: "Submissions are not configured on this deployment." },
      { status: 503 },
    );
  }

  // Identify the caller from their own bearer token. The secret key is used for
  // the write, but only after establishing who is asking.
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sign in to submit a can." }, { status: 401 });
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) {
    return NextResponse.json({ error: "Your session has expired." }, { status: 401 });
  }

  // Must have claimed a handle — submissions are attributed.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json(
      { error: "Pick a handle before submitting." },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const barcode = str(body.barcode, 32)?.replace(/[^0-9]/g, "") || null;

  // --- try Open Food Facts first ---
  let off: Record<string, unknown> | null = null;
  if (barcode) off = await lookupBarcode(barcode);

  let name: string | null;
  let brand: string | null;
  let ml: number | null;
  let caf: number | null;
  let sug: number | null = null;
  let cal: number | null = null;
  let imageUrl: string | null = null;
  let imageSmallUrl: string | null = null;
  let verified = false;

  const nutriments = (off?.nutriments ?? null) as Record<string, number> | null;
  const offMl = off ? parseMl(off.quantity, off.serving_size) : null;
  const offCaf =
    nutriments && offMl && typeof nutriments["caffeine_100g"] === "number"
      ? nutriments["caffeine_100g"] * (offMl / 100) * 1000
      : null;

  if (off && offMl && offCaf && caffeinePlausible(offCaf, offMl)) {
    // Corroborated — trust Open Food Facts over the form.
    verified = true;
    name =
      str(off.product_name_en, 120) ??
      str(off.product_name, 120) ??
      str(body.name, 120);
    brand = str(off.brands, 80) ?? str(body.brand, 80);
    ml = Math.round(offMl);
    caf = Math.round(offCaf);
    const s = nutriments?.["sugars_100g"];
    if (typeof s === "number") {
      const total = s * (offMl / 100);
      if (total >= 0 && (total / offMl) * 100 <= 20) sug = Math.round(total);
    }
    const k = nutriments?.["energy-kcal_100g"];
    if (typeof k === "number") {
      const total = k * (offMl / 100);
      if (total >= 0 && (total / offMl) * 100 <= 85) cal = Math.round(total);
    }
    imageUrl = str(off.image_front_url, 400);
    imageSmallUrl = str(off.image_front_small_url, 400);
  } else {
    // Queued: use what the user typed, validated.
    name = str(body.name, 120);
    brand = str(body.brand, 80);
    ml = num(body.ml);
    caf = num(body.caf);
    const s = num(body.sug);
    const k = num(body.cal);
    if (s !== null && ml && s >= 0 && (s / ml) * 100 <= 20) sug = Math.round(s);
    if (k !== null && ml && k >= 0 && (k / ml) * 100 <= 85) cal = Math.round(k);
  }

  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Give the can a name." }, { status: 400 });
  }
  if (!brand) {
    return NextResponse.json({ error: "Which brand is it?" }, { status: 400 });
  }
  if (!ml || ml < 15 || ml > 2000) {
    return NextResponse.json(
      { error: "Size looks wrong — give the volume in ml or oz." },
      { status: 400 },
    );
  }
  if (caf === null || !caffeinePlausible(caf, ml)) {
    return NextResponse.json(
      {
        error:
          "Caffeine looks implausible for that size. Check the label — it should be 40-400 mg per can.",
      },
      { status: 400 },
    );
  }

  const oz = ml / 29.5735;
  const id = barcode ? barcode : `user:${crypto.randomUUID()}`;

  // Deterministic colour so a submission doesn't reshuffle existing ones.
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;

  const row = {
    id,
    barcode,
    name,
    brand,
    sub: oz >= 1 ? `${oz.toFixed(1).replace(/\.0$/, "")} oz` : `${Math.round(ml)} ml`,
    ml: Math.round(ml),
    caf: Math.round(caf),
    sug,
    cal,
    // Placed mid-axis; the importer recomputes real positions on next run.
    sweet: sug === null ? 50 : Math.min(96, Math.max(6, Math.round((sug / ml) * 100 * 6))),
    nuke: Math.min(96, Math.max(6, Math.round(((caf / ml) * 100 - 25) * 2.2))),
    color: PALETTE[hash % PALETTE.length],
    image_url: imageUrl,
    image_small_url: imageSmallUrl,
    source: barcode ? `https://world.openfoodfacts.org/product/${barcode}` : null,
    us: true,
    status: verified ? "live" : "pending",
    submitted_by: profile.id,
  };

  // --- resubmission handling ---
  //
  // One person submitting the same can twice must not create two rows. A can
  // with a barcode dedupes on the barcode (the primary key). One without —
  // an Aldi store brand, say — dedupes on this submitter plus a normalised
  // brand+name, and their second attempt updates the first rather than piling
  // up near-identical queue entries.
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  const dedupeKey = norm(`${brand}${name}`);

  const { data: existing } = barcode
    ? await supabase
        .from("drinks")
        .select("id, status, submitted_by")
        .eq("id", barcode)
        .maybeSingle()
    : await supabase
        .from("drinks")
        .select("id, status, submitted_by, brand, name")
        .eq("submitted_by", profile.id)
        .eq("status", "pending")
        .then(({ data }) => ({
          data:
            (data ?? []).find(
              (d) => norm(`${d.brand}${d.name}`) === dedupeKey,
            ) ?? null,
        }));

  if (existing) {
    if (existing.status === "live") {
      return NextResponse.json(
        { error: "That can is already in the league." },
        { status: 409 },
      );
    }
    if (existing.submitted_by !== profile.id) {
      return NextResponse.json(
        { error: "Someone has already submitted that one — it is under review." },
        { status: 409 },
      );
    }
    // their own pending submission: replace it. id and submitted_by are
    // deliberately not updated — the row keeps its identity and its owner.
    const updatable = { ...row };
    delete (updatable as Partial<typeof row>).id;
    delete (updatable as Partial<typeof row>).submitted_by;
    const { error: updErr } = await supabase
      .from("drinks")
      .update({ ...updatable, reviewed_at: null, reject_reason: null })
      .eq("id", existing.id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }
    return NextResponse.json({
      status: row.status,
      id: existing.id,
      name: row.name,
      verified,
      updated: true,
      message: verified
        ? `${row.name} verified and added to the league.`
        : `Updated your earlier submission of ${row.name}.`,
    });
  }

  const { error } = await supabase
    .from("drinks")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That can is already in the league." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    status: row.status,
    id: row.id,
    name: row.name,
    verified,
    updated: false,
    message: verified
      ? `${row.name} verified against Open Food Facts and added to the league.`
      : `${row.name} submitted for review.`,
  });
}
