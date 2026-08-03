-- Cansensus — initial schema
--
-- Design notes that matter:
--
-- 1. A profile carries ONLY a chosen handle. Google hands back a real name and
--    email; neither is copied here, so there is nothing in the public schema
--    that can leak someone's identity. auth.users keeps the email privately.
--
-- 2. Rating scores are computed by a trigger, never accepted from the client.
--    A caller who writes directly through the REST API still cannot fake a
--    score — the trigger overwrites whatever they send.
--
-- 3. Missing nutrition stays NULL. The UI renders "—" for null and must never
--    substitute zero; a can with unknown sugar is not a zero-sugar can.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text not null unique
                check (handle ~ '^[a-z0-9_]{3,20}$'),
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Public identity. Deliberately holds no name or email — the handle is the '
  'only thing other users ever see.';

-- Handles that must not be claimable by a user.
create table public.reserved_handles (handle text primary key);

insert into public.reserved_handles (handle) values
  ('admin'), ('administrator'), ('root'), ('moderator'), ('mod'),
  ('support'), ('help'), ('energyleague'), ('energy_league'), ('official'),
  ('you'), ('anonymous'), ('anon'), ('deleted'), ('system'), ('api');

create or replace function public.reject_reserved_handle()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from public.reserved_handles where handle = new.handle) then
    raise exception 'handle "%" is reserved', new.handle
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_reject_reserved
  before insert or update of handle on public.profiles
  for each row execute function public.reject_reserved_handle();

-- ---------------------------------------------------------------------------
-- drinks
-- ---------------------------------------------------------------------------

create table public.drinks (
  -- barcode where one exists, otherwise 'user:<uuid>' for submissions of cans
  -- no public database carries (Aldi's Gridlock, for instance)
  id              text primary key,
  barcode         text unique,
  name            text not null check (length(trim(name)) between 2 and 120),
  brand           text not null,
  sub             text not null,                       -- "16 oz"
  ml              integer not null check (ml between 15 and 2000),

  -- Caffeine is bounded because it is health information. Open Food Facts
  -- contributors enter mg into a grams field and produce values like 710 mg
  -- for a 355 ml can; the importer rejects those and so does the database.
  caf             integer not null check (caf between 0 and 500),
  -- Same class of bound, for the same reason: a contributor entering kJ into a
  -- kcal field produced 56,800 kcal for a 355 ml can. Physical ceilings are
  -- ~20 g sugar and ~85 kcal per 100 ml, applied here against the can volume.
  sug             numeric(5,1) check (sug >= 0 and sug <= ml * 0.20),
  cal             integer check (cal >= 0 and cal <= ml * 0.85),

  sweet           integer not null check (sweet between 0 and 100),
  nuke            integer not null check (nuke between 0 and 100),
  color           text not null,
  image_url       text,
  image_small_url text,
  source          text,
  us              boolean not null default false,
  price           numeric(6,2) check (price > 0),       -- null = not sourced

  status          text not null default 'pending'
                    check (status in ('live', 'pending', 'rejected')),
  submitted_by    uuid references public.profiles (id) on delete set null,
  reviewed_at     timestamptz,
  reject_reason   text,
  created_at      timestamptz not null default now()
);

comment on column public.drinks.caf is
  'mg per can. Bounded 0-500: contributor typos in the upstream source '
  'routinely overstate a stimulant dose by several multiples.';
comment on column public.drinks.sug is
  'g per can. NULL means unknown, which is NOT the same as zero.';
comment on column public.drinks.status is
  'Catalog rows imported from Open Food Facts land as live. User submissions '
  'land as pending unless an Open Food Facts match verified them.';

create index drinks_status_idx on public.drinks (status);
create index drinks_brand_idx on public.drinks (brand);

-- No trigram index on name yet: the can picker filters client-side over a few
-- dozen rows, and a gin/pg_trgm index would make this migration depend on which
-- schema Supabase installs the extension into. Add it when the catalog is big
-- enough to need server-side search.

-- ---------------------------------------------------------------------------
-- ratings
-- ---------------------------------------------------------------------------

create table public.ratings (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  drink_id    text not null references public.drinks (id) on delete cascade,
  taste       smallint not null check (taste      between 1 and 10),
  kick        smallint not null check (kick       between 1 and 10),
  aftertaste  smallint not null check (aftertaste between 1 and 10),
  value       smallint not null check (value      between 1 and 10),
  -- always overwritten by the trigger below
  score       numeric(4,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- one rating per person per can; makes submitting an upsert, and is what
  -- stops a single account from stuffing the ballot
  primary key (user_id, drink_id)
);

create index ratings_drink_idx on public.ratings (drink_id);

-- The canonical composite. These weights MUST match SLIDER_DEFS in
-- src/lib/data.ts — taste .38, kick .28, aftertaste .20, value .14.
create or replace function public.compute_rating_score()
returns trigger
language plpgsql
as $$
begin
  new.score := round(
      new.taste      * 0.38
    + new.kick       * 0.28
    + new.aftertaste * 0.20
    + new.value      * 0.14
  , 2);
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.compute_rating_score() is
  'Recomputes score from the four sliders on every write, so a client-supplied '
  'score is always discarded.';

create trigger ratings_compute_score
  before insert or update on public.ratings
  for each row execute function public.compute_rating_score();

-- ---------------------------------------------------------------------------
-- weekly snapshots — what makes the Δ column and the form guide real
-- ---------------------------------------------------------------------------

create table public.drink_weekly_scores (
  drink_id  text not null references public.drinks (id) on delete cascade,
  week      date not null,                             -- the Monday
  score     numeric(4,2) not null,
  votes     integer not null check (votes >= 0),
  primary key (drink_id, week)
);

comment on table public.drink_weekly_scores is
  'Frozen Monday standings. Until this has eight rows per drink the sparkline '
  'stays empty rather than being synthesised.';

-- ---------------------------------------------------------------------------
-- aggregates
-- ---------------------------------------------------------------------------

-- security_invoker so the view runs with the caller's permissions and RLS on
-- the underlying tables still applies. Without it a view is a way around RLS.
create view public.drink_stats
  with (security_invoker = true)
as
  select
    d.id                                            as drink_id,
    round(avg(r.score), 2)                          as score,
    count(r.user_id)                                as votes,
    round(coalesce(stddev_pop(r.score), 0), 2)      as sd
  from public.drinks d
  left join public.ratings r on r.drink_id = d.id
  where d.status = 'live'
  group by d.id;

comment on view public.drink_stats is
  'Replaces the invented crowd score / vote count / spread. score is NULL '
  'until someone rates the can.';

-- Leaderboard source: handle plus how many cans they have logged.
create view public.taster_stats
  with (security_invoker = true)
as
  select
    p.id,
    p.handle,
    count(r.drink_id)   as rated_count,
    max(r.updated_at)   as last_rated_at
  from public.profiles p
  left join public.ratings r on r.user_id = p.id
  group by p.id, p.handle;
