import { averageOf, caffeineDensity } from "@/lib/scoring";
import type { Drink, Ratings } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

/**
 * Everything here except your own progress needs real accounts. The prototype
 * shipped a leaderboard of eight invented tasters and matched you against them
 * for a "taste twin" — a match percentage computed against people who do not
 * exist. That is gone until sign-in lands; what remains is genuinely yours.
 */
export function TastersSection({ drinks, ratings }: { drinks: Drink[]; ratings: Ratings }) {
  const rated = drinks.filter((d) => ratings[d.id]);
  const myCount = rated.length;

  const badges = [
    { label: "First sip", on: myCount >= 1, at: 1 },
    { label: "Five cans deep", on: myCount >= 5, at: 5 },
    { label: "Ten deep", on: myCount >= 10, at: 10 },
    { label: "Half the catalog", on: myCount >= Math.floor(drinks.length / 2), at: Math.floor(drinks.length / 2) },
    { label: "Completionist", on: myCount >= drinks.length, at: drinks.length },
  ];
  const next = badges.find((b) => !b.on);

  const avgScore = averageOf(rated, (d) => ratings[d.id]?.score ?? null);
  const avgCaf = averageOf(rated, (d) => d.caf);
  const avgDensity = averageOf(rated, caffeineDensity);
  const favourite = [...rated].sort(
    (a, b) => (ratings[b.id]?.score ?? 0) - (ratings[a.id]?.score ?? 0),
  )[0];

  return (
    <section id="people" className="section">
      <div className="wrap">
        <SectionHeader num="06" title="The tasters" />
        <p className="lede">
          Leaderboards and taste-matching need real accounts, so they arrive with
          Google sign-in. Until then this is your own card.
        </p>

        <div className="grid310" style={{ marginTop: 26 }}>
          <div className="card">
            <div className="label" style={{ marginBottom: 14 }}>
              Your card
            </div>

            <div className="youStat">
              <span className="display youStatValue">{myCount}</span>
              <span className="youStatLabel">
                of {drinks.length} cans rated
              </span>
            </div>

            <div
              className="bar"
              style={{ marginTop: 14, marginBottom: 20, height: 6 }}
            >
              <div
                className="barFill"
                style={{
                  background: "var(--lime)",
                  width: `${Math.round((myCount / drinks.length) * 100)}%`,
                }}
              />
            </div>

            {myCount > 0 ? (
              <dl className="factList">
                <Fact
                  label="Average score you give"
                  value={(avgScore ?? 0).toFixed(2)}
                />
                <Fact
                  label="Average caffeine you rate"
                  value={`${Math.round(avgCaf ?? 0)} mg`}
                />
                <Fact
                  label="Average intensity"
                  value={`${(avgDensity ?? 0).toFixed(0)} mg / 100 ml`}
                />
                {favourite && (
                  <Fact label="Your top can" value={favourite.name} />
                )}
              </dl>
            ) : (
              <p className="emptyNote">
                Rate a can and your averages appear here.
              </p>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="twinCard">
              <div
                className="label"
                style={{ color: "var(--orange)", marginBottom: 12 }}
              >
                Arriving with sign-in
              </div>
              <ul className="pendingList">
                <li>
                  <strong>Google sign-in</strong> — with a username you choose,
                  so your real name never appears anywhere on the site.
                </li>
                <li>
                  <strong>Most cans logged</strong> — a real leaderboard, once
                  there is more than one taster.
                </li>
                <li>
                  <strong>Your taste twin</strong> — matched on who actually
                  scores cans the way you do, not on a synthetic profile.
                </li>
                <li>
                  <strong>Add a can</strong> — submit anything missing, including
                  store brands like Aldi&apos;s Gridlock that no public database
                  carries.
                </li>
              </ul>
            </div>

            <div className="card">
              <div className="label" style={{ marginBottom: 14 }}>
                Your badges
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {badges.map((b) => (
                  <span
                    key={b.label}
                    className="mono"
                    style={{
                      fontSize: 10,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      borderRadius: 99,
                      padding: "8px 13px",
                      border: `1px solid ${b.on ? "#D8FF3E" : "#23261E"}`,
                      color: b.on ? "#D8FF3E" : "#4A5040",
                      background: b.on ? "rgba(216,255,62,.1)" : "transparent",
                    }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
              <div
                className="mono"
                style={{ fontSize: 11, color: "var(--dim)", marginTop: 16 }}
              >
                {next
                  ? `Next up: rate ${next.at - myCount} more for ${next.label}.`
                  : "Every can rated. Genuinely impressive, slightly concerning."}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="factRow">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
