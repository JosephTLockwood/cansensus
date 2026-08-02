# Phase 2 — wiring up the backend

Phase 1 is done: the whole league runs in the browser, and one person's ratings
live in `localStorage`. That is a real product for one user and a fake product
for everyone else, because the "crowd" is a hard-coded array.

This document is the plan for making the crowd real. Nothing here is built yet.

---

## What is currently fake

| Thing | Where it lives now | What it needs to be |
| --- | --- | --- |
| The 16 cans | `src/lib/data.ts` → `DRINKS` | a `drinks` table |
| Crowd score `s`, vote count `v`, spread `sd` | hard-coded per drink | aggregates over a `ratings` table |
| Last week's score `prev` | hard-coded per drink | a `drink_weekly_scores` snapshot row |
| The 8-week sparkline | `history()` — deterministic fake wobble | eight real snapshot rows |
| The eight other tasters | `src/lib/data.ts` → `PEOPLE` | a `profiles` table |
| Your ratings | `localStorage` under `edl.v1` | rows in `ratings`, keyed to your user id |
| "You" in the leaderboard | synthesised client-side | just another profile |

The two things that are **not** fake and do not need a backend: the scoring
maths (`src/lib/scoring.ts`) and the entire UI. Those keep working unchanged.

## The seam that already exists

`src/lib/ratings-source.ts` defines the only interface the app uses to reach
persistence:

```ts
export interface RatingsSource {
  load(): Promise<Ratings>;
  save(drinkId: string, rating: Rating): Promise<void>;
}
```

`LeagueApp` takes a `ratingsSource` prop and defaults to `localRatingsSource`.
So step one of phase 2 is writing a second implementation and passing it in —
no component touched:

```ts
export const apiRatingsSource: RatingsSource = {
  async load() {
    const res = await fetch("/api/ratings");
    return res.ok ? res.json() : {};
  },
  async save(drinkId, rating) {
    await fetch("/api/ratings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drinkId, ...rating }),
    });
  },
};
```

That is deliberately the smallest possible first step, and it is worth shipping
on its own before anything below.

---

## Recommended stack

**Supabase (Postgres + Auth) behind Next.js route handlers, on Vercel.**

Both free tiers cover this comfortably: Supabase free gives 500 MB of Postgres
and 50k monthly active users, Vercel Hobby gives the hosting. A league with
thousands of ratings is a few megabytes.

Why Supabase over the alternatives:

- **vs. Vercel Postgres / Neon** — those are just Postgres. Supabase throws in
  auth, which is the part that is genuinely annoying to build.
- **vs. Firebase** — the aggregates here are SQL-shaped (`avg`, `stddev`,
  `group by`). Doing them in Firestore means maintaining counters by hand.
- **vs. a Vercel KV blob** — no aggregation, and the crowd stats are the whole
  point of the app.

One firm recommendation: **call Supabase from route handlers, not from the
browser.** Browser-side `supabase-js` with row-level security works, but it
puts your scoring rules in client code where they can be edited. Ratings are
the one thing people have an incentive to cheat at.

## Schema

```sql
-- Supabase manages auth.users; this is the public-facing half.
create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  handle      text unique not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  created_at  timestamptz not null default now()
);

create table drinks (
  id        text primary key,          -- 'rb', 'mon', ... same ids as today
  name      text not null,
  serving   text not null,             -- Drink.sub
  caffeine  int  not null,             -- mg
  sugar     int  not null,             -- g
  calories  int  not null,
  price     numeric(5,2) not null,
  sweet     int  not null check (sweet between 0 and 100),
  nuke      int  not null check (nuke  between 0 and 100),
  tags      text[] not null default '{}',
  note      text not null,
  color     text not null,
  active    bool not null default true
);

create table ratings (
  user_id    uuid not null references profiles on delete cascade,
  drink_id   text not null references drinks,
  taste      smallint not null check (taste between 1 and 10),
  kick       smallint not null check (kick  between 1 and 10),
  after      smallint not null check (after between 1 and 10),
  value      smallint not null check (value between 1 and 10),
  score      numeric(4,2) not null,    -- recomputed server-side, never trusted
  updated_at timestamptz not null default now(),
  primary key (user_id, drink_id)       -- one rating per person per can
);

-- Frozen Monday-morning standings; this is what makes `prev` and the
-- 8-week sparkline real instead of synthesised.
create table drink_weekly_scores (
  drink_id   text not null references drinks,
  week       date not null,            -- the Monday
  score      numeric(4,2) not null,
  votes      int not null,
  primary key (drink_id, week)
);
```

The composite primary key on `ratings` is what makes "submit" an upsert and
gives you the existing "Updates your existing rating" behaviour for free.

### The aggregate the table reads

```sql
create view drink_stats as
select d.id,
       coalesce(avg(r.score), 0)::numeric(4,2)  as score,
       count(r.user_id)                          as votes,
       coalesce(stddev_pop(r.score), 0)::numeric(4,2) as sd
from drinks d
left join ratings r on r.drink_id = d.id
where d.active
group by d.id;
```

That view replaces the hard-coded `s`, `v` and `sd` fields. Start as a plain
view; promote to a materialized view refreshed on a cron only if it ever gets
slow, which at this scale it will not.

**Keep `blended()`.** It looks like a workaround for having no backend, but it
is not — it is what makes the table move the instant you submit, instead of
your one vote vanishing into an average of 1,800. Once ratings are real, feed
it the live `drink_stats` numbers and it keeps doing the same job.

## API surface

| Route | Method | Does |
| --- | --- | --- |
| `/api/standings` | GET | drinks joined to `drink_stats` + last week's rank |
| `/api/ratings` | GET | the caller's own ratings, as the `Ratings` shape |
| `/api/ratings` | PUT | upsert one rating; **recompute `score` server-side** |
| `/api/tasters` | GET | leaderboard: handle, rating count, streak |
| `/api/me` | GET | profile + badge state |

Two rules worth writing down now:

1. **Never trust the client's `score`.** Take the four 1-10 sliders, apply
   `SLIDER_DEFS` weights on the server, store that. The client sends `score`
   today only because the client *is* the server.
2. **Rate-limit `PUT /api/ratings`.** The primary key stops mass ballot-stuffing
   from one account, so the real exposure is signup abuse, not write volume.

## Auth

Supabase Auth, magic-link email plus GitHub OAuth. Two things matter for this
app specifically:

- **Do not gate the read path.** The standings, trends, map and lab must all
  render for a logged-out visitor. Signup is the price of *voting*, not of
  looking, and gating the table would gut the thing that makes the page worth
  sharing.
- **Anonymous ratings need a migration path.** Anyone who used the site in
  phase 1 has ratings in `localStorage`. On first login, offer to import them:
  read `edl.v1`, `PUT` each one, then clear the key. Without that, early users
  are silently punished for having shown up early.

## Order to build it in

1. `drinks` table + `/api/standings`; delete the `DRINKS` array. Read-only,
   ships on its own, nothing can break.
2. Auth + `profiles`. Login only, no writes yet.
3. `ratings` + `/api/ratings` + `apiRatingsSource`. This is the real cutover.
4. The `localStorage` import prompt.
5. `/api/tasters` — replaces the `PEOPLE` array and makes the taste-twin
   calculation mean something.
6. A weekly cron writing `drink_weekly_scores`. Until it has run 8 times the
   sparkline is still partly synthetic, so keep `history()` as the fallback for
   drinks with fewer than 8 snapshots.

Steps 1-3 are the ones that turn this from a toy into a product. 4-6 are
polish, and step 6 quietly needs eight weeks of wall-clock time before it looks
right — worth starting the cron early even if nothing reads from it yet.
