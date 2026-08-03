/**
 * Applies schema and auth config to the Supabase project via the Management
 * API, so setup is reproducible instead of a sequence of dashboard clicks.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/supabase-admin.mjs status
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx node scripts/supabase-admin.mjs migrate
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... \
 *     node scripts/supabase-admin.mjs enable-google
 *
 * The access token is read from the environment and never written to disk or
 * committed. A Supabase personal access token grants access to the whole
 * account, so revoke it once setup is done:
 *   https://supabase.com/dashboard/account/tokens
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REF = process.env.SUPABASE_PROJECT_REF ?? "ujuyfevyaokbvfmmpdeu";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const API = "https://api.supabase.com/v1";

if (!TOKEN) {
  console.error(
    "SUPABASE_ACCESS_TOKEN is not set.\n" +
      "Create one at https://supabase.com/dashboard/account/tokens",
  );
  process.exit(1);
}

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${path} -> ${res.status}\n${
        typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2)
      }`,
    );
  }
  return parsed;
}

const runSql = (query) =>
  api(`/projects/${REF}/database/query`, { method: "POST", body: { query } });

/** Applied whole, in order, so a migration is all-or-nothing. */
const FILES = [
  "supabase/migrations/0001_schema.sql",
  "supabase/migrations/0002_policies.sql",
  "supabase/seed.sql",
];

async function migrate() {
  for (const rel of FILES) {
    const sql = readFileSync(join(ROOT, rel), "utf8");
    process.stdout.write(`${rel} ... `);
    try {
      await runSql(sql);
      console.log("OK");
    } catch (err) {
      console.log("FAILED");
      console.error(`\n${err.message}\n`);
      process.exit(1);
    }
  }
  await status();
}

async function enableGoogle() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !secret) {
    console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    process.exit(1);
  }
  const siteUrl = process.env.SITE_URL ?? "https://cansensus.vercel.app";
  await api(`/projects/${REF}/config/auth`, {
    method: "PATCH",
    body: {
      external_google_enabled: true,
      external_google_client_id: clientId,
      external_google_secret: secret,
      site_url: siteUrl,
      // Both hosts, plus localhost for development.
      // The old energy-league URL stays listed so any bookmarked link still
      // completes sign-in rather than failing on the redirect.
      uri_allow_list: [
        siteUrl,
        `${siteUrl}/`,
        "https://energy-league.vercel.app",
        "https://energy-league.vercel.app/",
        "http://localhost:3000",
        "http://localhost:3000/",
      ].join(","),
    },
  });
  console.log(`google enabled, site_url = ${siteUrl}`);
}

async function status() {
  const auth = await api(`/projects/${REF}/config/auth`);
  console.log("\n--- auth ---");
  console.log("  google enabled :", auth.external_google_enabled);
  console.log("  site url       :", auth.site_url);

  try {
    const rows = await runSql(`
      select
        (select count(*) from public.drinks)                     as drinks,
        (select count(*) from public.drinks where status='live') as live,
        (select count(*) from public.profiles)                   as profiles,
        (select count(*) from public.ratings)                    as ratings;
    `);
    console.log("--- tables ---");
    console.log(" ", JSON.stringify(Array.isArray(rows) ? rows[0] : rows));
  } catch {
    console.log("--- tables ---");
    console.log("  not created yet — run `migrate`");
  }
}

const commands = { migrate, "enable-google": enableGoogle, status };
const cmd = process.argv[2];

if (!commands[cmd]) {
  console.error(
    `usage: node scripts/supabase-admin.mjs <${Object.keys(commands).join(" | ")}>`,
  );
  process.exit(1);
}

await commands[cmd]();
