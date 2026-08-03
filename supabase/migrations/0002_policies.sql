-- Row level security.
--
-- Two rules shape all of this:
--
--   READ IS OPEN. The standings, map and lab must render for a logged-out
--   visitor. Signing in is the price of voting, not of looking — gating the
--   table would remove the reason anyone shares the page.
--
--   WRITES ARE NARROW. A signed-in user may write exactly their own ratings and
--   their own profile. Everything else — putting a drink live, weekly
--   snapshots, moderation — is server-side only, reachable with the secret key
--   from a route handler and never from the browser.

alter table public.profiles            enable row level security;
alter table public.reserved_handles    enable row level security;
alter table public.drinks              enable row level security;
alter table public.ratings             enable row level security;
alter table public.drink_weekly_scores enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Handles are public by design: they appear on the leaderboard, and the signup
-- flow needs to tell you a handle is taken. No email or name lives here.
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users create their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Deliberately no delete policy: account deletion cascades from auth.users,
-- so it does not need a client-reachable path.

-- ---------------------------------------------------------------------------
-- reserved_handles — readable so the signup form can explain a rejection,
-- writable by nobody through the API.
-- ---------------------------------------------------------------------------

create policy "reserved handles are readable"
  on public.reserved_handles for select
  using (true);

-- ---------------------------------------------------------------------------
-- drinks
-- ---------------------------------------------------------------------------

create policy "live drinks are publicly readable"
  on public.drinks for select
  using (status = 'live');

-- So a submitter can see their own can sitting in the queue.
create policy "submitters see their own pending drinks"
  on public.drinks for select
  to authenticated
  using (submitted_by = auth.uid());

-- No client INSERT policy. Submissions go through a route handler that looks
-- the can up in Open Food Facts first and decides live-vs-pending server-side;
-- letting the browser insert would let it choose its own status.

-- ---------------------------------------------------------------------------
-- ratings
-- ---------------------------------------------------------------------------

-- Public read is required: drink_stats runs with security_invoker, so an
-- anonymous visitor must be able to read ratings for the averages to compute.
-- Individual scores are the point of the site, not a secret.
create policy "ratings are publicly readable"
  on public.ratings for select
  using (true);

create policy "users insert their own ratings"
  on public.ratings for insert
  to authenticated
  with check (
    auth.uid() = user_id
    -- cannot rate a can that is not live
    and exists (
      select 1 from public.drinks d
      where d.id = drink_id and d.status = 'live'
    )
  );

create policy "users update their own ratings"
  on public.ratings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users delete their own ratings"
  on public.ratings for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- weekly snapshots — read by everyone, written only by the cron job
-- ---------------------------------------------------------------------------

create policy "weekly scores are publicly readable"
  on public.drink_weekly_scores for select
  using (true);

-- ---------------------------------------------------------------------------
-- handle availability, without exposing the table to enumeration abuse
-- ---------------------------------------------------------------------------

create or replace function public.handle_available(candidate text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    candidate ~ '^[a-z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles where handle = candidate)
    and not exists (select 1 from public.reserved_handles where handle = candidate);
$$;

comment on function public.handle_available(text) is
  'True when a handle is well-formed, unclaimed and not reserved. Lets the '
  'signup form validate without reading the profiles table directly.';

grant execute on function public.handle_available(text) to anon, authenticated;
