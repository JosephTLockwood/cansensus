import { DRINKS, PALETTE, PEOPLE } from "@/lib/data";
import type { Person, Ratings } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

export function TastersSection({ ratings }: { ratings: Ratings }) {
  const myCount = Object.keys(ratings).length;
  const twin = findTasteTwin(ratings);

  const leaders = [
    ...PEOPLE.map((p) => ({ ...p, you: false })),
    {
      name: "you",
      count: myCount,
      streak: myCount ? "1d" : "—",
      badge: myCount ? "Rookie · keep going" : "Unranked · rate a can to enter",
      sweetPref: 0,
      nukePref: 0,
      you: true,
    },
  ].sort((a, b) => b.count - a.count);

  const badges = [
    { label: "First sip", on: myCount >= 1 },
    { label: "Five cans deep", on: myCount >= 5 },
    { label: "Half the league", on: myCount >= 8 },
    { label: "Completionist", on: myCount >= DRINKS.length },
  ];

  const nextBadge =
    myCount >= DRINKS.length
      ? "Every can rated. Genuinely impressive, slightly concerning."
      : `Next up: rate ${
          myCount < 5
            ? `${5 - myCount} more for Five cans deep`
            : myCount < 8
              ? `${8 - myCount} more for Half the league`
              : `${DRINKS.length - myCount} more for Completionist`
        }`;

  return (
    <section id="people" className="section">
      <div className="wrap">
        <SectionHeader num="06" title="The tasters" />

        <div className="grid310" style={{ marginTop: 26 }}>
          <div className="card">
            <div className="label" style={{ marginBottom: 14 }}>
              Most cans logged
            </div>
            {leaders.map((p, i) => (
              <div
                key={p.name}
                className="leaderRow"
                style={{
                  background: p.you ? "rgba(255,91,36,.09)" : "transparent",
                  border: `1px solid ${p.you ? "#4A2A18" : "transparent"}`,
                }}
              >
                <span
                  className="display"
                  style={{
                    fontSize: 16,
                    width: 26,
                    color: i < 3 ? "#D8FF3E" : "#4A5040",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  className="avatar"
                  style={{
                    width: 34,
                    height: 34,
                    fontSize: 13,
                    background: p.you
                      ? "#FF5B24"
                      : PALETTE[(i * 3) % PALETTE.length],
                  }}
                  aria-hidden="true"
                >
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 10,
                      color: "var(--dim)",
                      letterSpacing: ".06em",
                      textTransform: "uppercase",
                    }}
                  >
                    {p.badge}
                  </div>
                </div>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--gold)" }}
                >
                  {p.streak}
                </span>
                <span
                  className="display"
                  style={{
                    fontSize: 20,
                    color: "var(--lime)",
                    width: 44,
                    textAlign: "right",
                  }}
                >
                  {p.count}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            <div className="twinCard">
              <div
                className="label"
                style={{ color: "var(--orange)", marginBottom: 12 }}
              >
                Your taste twin
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: 14 }}
              >
                <span
                  className="avatar"
                  style={{
                    width: 52,
                    height: 52,
                    fontSize: 18,
                    background: twin ? "#FF5B24" : "#3A4030",
                  }}
                  aria-hidden="true"
                >
                  {twin ? twin.person.name.slice(0, 2).toUpperCase() : "??"}
                </span>
                <div>
                  <div
                    className="display"
                    style={{
                      fontSize: 24,
                      letterSpacing: "-.02em",
                      textTransform: "uppercase",
                    }}
                  >
                    {twin ? twin.person.name : "unknown"}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 11, color: "var(--muted)" }}
                  >
                    {twin
                      ? `${twin.match}% taste match · ${twin.person.count} cans logged`
                      : "Rate 3 cans to find your match"}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.5,
                  color: "var(--muted)",
                  marginTop: 14,
                  textWrap: "pretty",
                }}
              >
                {twin
                  ? `${twin.person.badge}. Their picks are the best predictor of what you will like next — they rate ${twin.person.sweetPref > 60 ? "sweet" : "tart"} cans highest.`
                  : "We match you against everyone in the league on sweetness and intensity preference, then tell you whose shelf to raid."}
              </div>
            </div>

            <div className="card">
              <div className="label" style={{ marginBottom: 14 }}>
                Your badges
              </div>
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
              >
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
                {nextBadge}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Scores every taster on how closely their sweetness/intensity preference
 * predicts the scores you actually gave, and returns the closest.
 *
 * Returns null until you have rated something — there is nothing to match on.
 */
function findTasteTwin(
  ratings: Ratings,
): { person: Person; match: number } | null {
  const ratedIds = Object.keys(ratings);
  if (ratedIds.length === 0) return null;

  const scored = PEOPLE.map((person) => {
    let distance = 0;
    let n = 0;
    for (const id of ratedIds) {
      const d = DRINKS.find((x) => x.id === id);
      if (!d) continue;
      // what we'd expect this person to score the can, given their profile
      const expected =
        5 +
        (10 - Math.abs(d.sweet - person.sweetPref) / 10) * 0.28 +
        (10 - Math.abs(d.nuke - person.nukePref) / 10) * 0.22;
      distance += Math.abs(expected - ratings[id].score);
      n++;
    }
    return {
      person,
      match: n ? Math.max(38, Math.round(100 - (distance / n) * 17)) : 0,
    };
  }).sort((a, b) => b.match - a.match);

  return scored[0];
}
