# Energy League

A crowd-sourced league table for energy drinks. Rate the cans you have actually
tasted on taste, kick, aftertaste and value; the crowd sorts out the truth, and
the results get cross-referenced against what is genuinely in the can.

Ported from a [Claude Design](https://claude.ai/design) prototype to Next.js.

## Status

**Phase 1 (frontend) — done.** Every section works: rating form, sortable and
filterable standings with expandable rows, form guide, flavour map, the lab
correlations, and the tasters leaderboard.

**Phase 2 (backend) — planned, not built.** Your ratings persist to
`localStorage`, so they survive a reload but live only in that browser. The
other 1,800-odd "crowd" votes and the eight other tasters are seed data in
`src/lib/data.ts`. See [docs/BACKEND.md](docs/BACKEND.md) for the schema, API
surface and build order.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npx tsc --noEmit # typecheck
npx eslint .     # lint
```

Node 20.9+ (Next.js 16 requirement).

## Layout

```
src/
  app/
    layout.tsx        fonts, metadata, sticky nav
    page.tsx          renders <LeagueApp />
    globals.css       design tokens + all structural CSS
  components/
    LeagueApp.tsx     owns shared state (ratings, selected can, form values)
    Hero, Ticker, RateSection, StandingsSection,
    TrendsSection, FlavourMap, LabSection,
    TastersSection, SiteFooter, Toast
  lib/
    data.ts           seed drinks/tasters + UI definitions (sliders, filters, columns)
    scoring.ts        every derived number — pure, no React
    ratings-source.ts THE BACKEND SEAM (see below)
    use-ratings.ts    hook wrapping a RatingsSource
    types.ts
docs/BACKEND.md       phase 2 plan
```

Two conventions worth knowing before editing:

- **Styling.** Static layout lives in `globals.css` as classes; only per-datum
  values (a can's colour, a bar's width) are inline styles. The palette and type
  scale are CSS custom properties on `:root`, ported 1:1 from the design file.
  There is no CSS framework.
- **Derived numbers.** Anything computed lives in `scoring.ts` as a pure
  function. No `Date.now()`, no `Math.random()` outside click handlers, so the
  server and client renders always agree.

### The backend seam

`src/lib/ratings-source.ts` is the only place that knows where ratings are
stored:

```ts
export interface RatingsSource {
  load(): Promise<Ratings>;
  save(drinkId: string, rating: Rating): Promise<void>;
}
```

`LeagueApp` accepts a `ratingsSource` prop and defaults to the localStorage
implementation. Swapping in an API-backed one is the first step of phase 2 and
touches no component.

## Deployment

Two targets, both configured in `next.config.ts`:

- **Vercel** (default) — a normal server build. This is the target for phase 2,
  since API routes and auth need a server.
- **GitHub Pages** — `DEPLOY_TARGET=gh-pages npm run build` emits a static
  `out/` under the `/energy-league` base path, deployed by
  `.github/workflows/deploy.yml`. This works only while all state is
  client-side; the first route handler ends it.

## Known limitations

- Ratings are per-browser and anonymous. Clearing site data loses them.
- The 8-week sparkline is interpolated between a can's stored previous score and
  its live score, with a deterministic wobble. It is a shape, not a record.
- The love/hate split on the divisive cards is derived from the rating spread,
  not from an actual histogram of votes.
- Nutrition figures are approximate per listed serving.

## Credits

Design and copy from the `Energy League.dc.html` Claude Design project —
[277b0286-11d2-438b-9e4c-e19f6c98ee5e](https://claude.ai/design/p/277b0286-11d2-438b-9e4c-e19f6c98ee5e),
the source to re-read if the design changes upstream.
Fonts: Archivo, Archivo Black, JetBrains Mono, self-hosted via `next/font`.
