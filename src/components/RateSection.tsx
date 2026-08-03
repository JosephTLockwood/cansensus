"use client";

import { useMemo, useState } from "react";
import { SLIDER_DEFS, tagsFor } from "@/lib/data";
import { compositeScore, fmtScore, scoreFor, verdictFor, votesFor } from "@/lib/scoring";
import type { Drink, Ratings, SliderKey, Vals } from "@/lib/types";
import { CanImage } from "./CanImage";
import { SectionHeader } from "./SectionHeader";

type Props = {
  /** Chips are shown in current ranking order. */
  chipOrder: Drink[];
  selected: Drink;
  ratings: Ratings;
  vals: Vals;
  onSelect: (id: string) => void;
  onChangeVal: (key: SliderKey, value: number) => void;
  onSubmit: () => void;
  onRoulette: () => void;
  onAddCan: () => void;
  /** False when signed out — rating requires an account. */
  canRate: boolean;
  onSignIn: () => Promise<{ error: string | null }>;
};

export function RateSection({
  chipOrder,
  selected,
  ratings,
  vals,
  onSelect,
  onChangeVal,
  onSubmit,
  onRoulette,
  onAddCan,
  canRate,
  onSignIn,
}: Props) {
  const [query, setQuery] = useState("");
  const liveScore = compositeScore(vals);
  const mine = ratings[selected.id];

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chipOrder;
    return chipOrder.filter(
      (d) =>
        d.name.toLowerCase().includes(q) || d.brand.toLowerCase().includes(q),
    );
  }, [chipOrder, query]);

  return (
    <section id="rate" className="section">
      <div className="wrap">
        <SectionHeader num="01" title="Log a can" />
        <p className="lede" style={{ margin: "12px 0 28px" }}>
          Pick what you&apos;ve had. Four scores, five seconds, no essay
          required.
        </p>

        <div className="grid310">
          {/* ---- the form ---- */}
          <div className="card">
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <span className="label">Step 1 — choose your poison</span>
              <button type="button" className="addCanLink mono" onClick={onAddCan}>
                + Add a can
              </button>
            </div>

            {/* At 38 cans the chip cloud already dominated the card, and user
                submissions only grow it. Filter first, then pick. */}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand or flavour…"
              aria-label="Search cans"
              className="mono canSearch"
            />

            <div
              className="mono"
              style={{ fontSize: 10, color: "var(--faint)", marginBottom: 8 }}
            >
              {shown.length} of {chipOrder.length} cans
            </div>

            <div className="chipRow">
              {shown.map((d) => {
                const on = d.id === selected.id;
                const rated = !!ratings[d.id];
                return (
                  <button
                    key={d.id}
                    type="button"
                    className="chip"
                    onClick={() => onSelect(d.id)}
                    aria-pressed={on}
                    style={{
                      border: `1px solid ${on ? "#D8FF3E" : rated ? "#3A4030" : "#23261E"}`,
                      background: on ? "rgba(216,255,62,.12)" : "transparent",
                      color: on ? "#D8FF3E" : rated ? "#F2F4EE" : "#8A9179",
                    }}
                  >
                    <span
                      className="chipSwatch"
                      style={{ background: d.color }}
                      aria-hidden="true"
                    />
                    {d.name}
                  </button>
                );
              })}
              {shown.length === 0 && (
                <p className="emptyNote">
                  Nothing matches “{query}”.{" "}
                  <button type="button" className="addCanLink mono" onClick={onAddCan}>
                    Add it to the catalog →
                  </button>
                </p>
              )}
            </div>

            <hr className="rule" />

            <div className="label" style={{ marginBottom: 16 }}>
              Step 2 — score it
            </div>
            {SLIDER_DEFS.map((s) => (
              <div key={s.key} style={{ marginBottom: 20 }}>
                <div className="sliderHead">
                  <div>
                    <label
                      htmlFor={`slider-${s.key}`}
                      style={{ fontWeight: 700, fontSize: 15 }}
                    >
                      {s.label}
                    </label>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        color: "var(--dim)",
                        marginLeft: 10,
                      }}
                    >
                      {s.hint}
                    </span>
                  </div>
                  <span className="sliderValue">{vals[s.key]}</span>
                </div>
                <input
                  id={`slider-${s.key}`}
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={vals[s.key]}
                  onChange={(e) => onChangeVal(s.key, Number(e.target.value))}
                />
              </div>
            ))}

            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginTop: 24,
              }}
            >
              {canRate ? (
                <button type="button" className="btnPrimary" onClick={onSubmit}>
                  Submit rating &rarr;
                </button>
              ) : (
                <button
                  type="button"
                  className="btnPrimary"
                  onClick={() => void onSignIn()}
                >
                  Sign in to rate &rarr;
                </button>
              )}
              <button type="button" className="btnGhost" onClick={onRoulette}>
                Roulette
              </button>
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--dim)" }}
              >
                {!canRate
                  ? "Ratings are tied to your account"
                  : mine
                    ? "Updates your existing rating"
                    : "Adds a new rating"}
              </span>
            </div>
          </div>

          {/* ---- the can being rated ---- */}
          <div className="selCard">
            <div
              style={{
                display: "flex",
                gap: 20,
                alignItems: "flex-start",
                flexWrap: "wrap",
              }}
            >
              <CanImage drink={selected} variant="panel" />

              <div style={{ minWidth: 0 }}>
                <div className="label">Now rating</div>
                <div
                  className="display"
                  style={{
                    fontSize: "clamp(22px, 2.2vw, 28px)",
                    lineHeight: 1.02,
                    letterSpacing: "-.03em",
                    textTransform: "uppercase",
                    margin: "8px 0 4px",
                  }}
                >
                  {selected.name}
                </div>
                <div
                  className="mono"
                  style={{ fontSize: 12, color: "var(--muted)" }}
                >
                  {selected.sub} · {selected.caf} mg caffeine ·{" "}
                  {selected.sug === null ? "sugar unknown" : `${selected.sug} g sugar`}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    marginTop: 14,
                  }}
                >
                  {tagsFor(selected).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>

                <div
                  style={{
                    marginTop: 18,
                    paddingTop: 16,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  <div className="kv">
                    <span>{selected.crowd ? "Crowd score" : "Your score"}</span>
                    <span style={{ color: "var(--lime)", fontWeight: 700 }}>
                      {fmtScore(scoreFor(selected, ratings))}
                    </span>
                  </div>
                  <div className="kv" style={{ marginTop: 6 }}>
                    <span>Your last score</span>
                    <span style={{ color: "var(--orange)", fontWeight: 700 }}>
                      {mine ? mine.score.toFixed(2) : "—"}
                    </span>
                  </div>
                  <div className="kv" style={{ marginTop: 6 }}>
                    <span>Ratings</span>
                    <span style={{ color: "var(--text)" }}>
                      {votesFor(selected, ratings).toLocaleString()}
                    </span>
                  </div>
                  <div className="kv" style={{ marginTop: 6 }}>
                    <span>Data</span>
                    <a
                      href={selected.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: 11 }}
                    >
                      Open Food Facts ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                borderTop: "1px solid var(--line)",
                paddingTop: 16,
              }}
            >
              <div className="label" style={{ marginBottom: 10 }}>
                Live preview of your verdict
              </div>
              <div
                style={{ display: "flex", alignItems: "baseline", gap: 12 }}
              >
                <span
                  className="display"
                  style={{
                    fontSize: 60,
                    lineHeight: 0.9,
                    color: "var(--lime)",
                  }}
                >
                  {liveScore.toFixed(2)}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: ".1em",
                  }}
                >
                  {verdictFor(liveScore)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
