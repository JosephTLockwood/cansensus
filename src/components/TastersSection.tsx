"use client";

import { PALETTE_FOR_HANDLE } from "@/lib/data";
import { averageOf, caffeineDensity } from "@/lib/scoring";
import type { Drink, Ratings } from "@/lib/types";
import { useTasters } from "@/lib/use-tasters";
import { SectionHeader } from "./SectionHeader";

/**
 * The leaderboard, your card, and your taste twin — all from real accounts.
 *
 * The prototype shipped eight invented tasters and matched you against them,
 * producing a "97% taste match" with someone who did not exist. That is gone.
 * The twin here compares the scores two real people gave the same cans, and
 * always reports how many cans that was, because a high match off one shared can
 * is arithmetic rather than insight.
 */
export function TastersSection({
  drinks,
  ratings,
  myHandle,
  myUserId,
}: {
  drinks: Drink[];
  ratings: Ratings;
  myHandle: string | null;
  myUserId: string | undefined;
}) {
  const { tasters, twin } = useTasters(ratings, myUserId);

  const rated = drinks.filter((d) => ratings[d.id]);
  const myCount = rated.length;

  const badges = [
    { label: "First sip", at: 1 },
    { label: "Five cans deep", at: 5 },
    { label: "Ten deep", at: 10 },
    { label: "Half the catalog", at: Math.max(2, Math.floor(drinks.length / 2)) },
    { label: "Completionist", at: Math.max(1, drinks.length) },
  ].map((b) => ({ ...b, on: myCount >= b.at }));
  const next = badges.find((b) => !b.on);

  const avgScore = averageOf(rated, (d) => ratings[d.id]?.score ?? null);
  const avgCaf = averageOf(rated, (d) => d.caf);
  const avgDensity = averageOf(rated, caffeineDensity);
  const favourite = [...rated].sort(
    (a, b) => (ratings[b.id]?.score ?? 0) - (ratings[a.id]?.score ?? 0),
  )[0];

  // Someone who signed in but hasn't rated anything isn't on a leaderboard yet.
  const ranked = tasters.filter((t) => t.ratedCount > 0);

  return (
    <section id="people" className="section">
      <div className="wrap">
        <SectionHeader num="06" title="The tasters" />
        <p className="lede">
          {ranked.length > 1
            ? `${ranked.length} people have rated something so far. Matching compares the scores you and they gave the same cans.`
            : "Ranked by cans logged. Taste matching needs two people to have rated the same can."}
        </p>

        <div className="grid310" style={{ marginTop: 26 }}>
          {/* ---- leaderboard ---- */}
          <div className="card">
            <div className="label" style={{ marginBottom: 14 }}>
              Most cans logged
            </div>

            {ranked.length === 0 ? (
              <p className="emptyNote">
                Nobody has rated anything yet. Be first.
              </p>
            ) : (
              ranked.map((t, i) => {
                const you = t.handle === myHandle;
                return (
                  <div
                    key={t.handle}
                    className="leaderRow"
                    style={{
                      background: you ? "rgba(255,91,36,.09)" : "transparent",
                      border: `1px solid ${you ? "#4A2A18" : "transparent"}`,
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
                        background: you
                          ? "#FF5B24"
                          : PALETTE_FOR_HANDLE(t.handle),
                      }}
                      aria-hidden="true"
                    >
                      {t.handle.slice(0, 2).toUpperCase()}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {t.handle}
                        {you && (
                          <span
                            className="mono"
                            style={{
                              fontSize: 10,
                              color: "var(--orange)",
                              marginLeft: 8,
                              letterSpacing: ".1em",
                            }}
                          >
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className="display"
                      style={{
                        fontSize: 20,
                        color: "var(--lime)",
                        width: 44,
                        textAlign: "right",
                      }}
                    >
                      {t.ratedCount}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* ---- taste twin ---- */}
            <div className="twinCard">
              <div
                className="label"
                style={{ color: "var(--orange)", marginBottom: 12 }}
              >
                Your taste twin
              </div>

              {twin ? (
                <>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 14 }}
                  >
                    <span
                      className="avatar"
                      style={{
                        width: 52,
                        height: 52,
                        fontSize: 18,
                        background: PALETTE_FOR_HANDLE(twin.handle),
                      }}
                      aria-hidden="true"
                    >
                      {twin.handle.slice(0, 2).toUpperCase()}
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
                        {twin.handle}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 11, color: "var(--muted)" }}
                      >
                        {twin.match}% match · {twin.shared} can
                        {twin.shared === 1 ? "" : "s"} in common ·{" "}
                        {twin.ratedCount} logged
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
                    {twin.shared < 3
                      ? `Off ${twin.shared} shared can${twin.shared === 1 ? "" : "s"} that percentage is arithmetic, not insight. Rate more of what they have rated and it starts to mean something.`
                      : `Across ${twin.shared} cans you both rated, your scores land within ${((100 - twin.match) / 10).toFixed(1)} points of each other on average.`}
                  </div>
                </>
              ) : (
                <p className="emptyNote">
                  {myCount === 0
                    ? "Rate a can and we can start matching you against other tasters."
                    : "Nobody else has rated a can you have rated yet. Matching needs an overlap."}
                </p>
              )}
            </div>

            {/* ---- your card ---- */}
            <div className="card">
              <div className="label" style={{ marginBottom: 14 }}>
                {myHandle ? `Your card · @${myHandle}` : "Your card"}
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
                    width: `${drinks.length ? Math.round((myCount / drinks.length) * 100) : 0}%`,
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
                  {myHandle
                    ? "Rate a can and your averages appear here."
                    : "Sign in and rate a can to get a card."}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 18,
                }}
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
                style={{ fontSize: 11, color: "var(--dim)", marginTop: 14 }}
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
