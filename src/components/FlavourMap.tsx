"use client";

import { DRINKS } from "@/lib/data";
import { caffeineDensity, fmtScore, rankMap, scoreFor } from "@/lib/scoring";
import type { Ratings } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

type Props = {
  ratings: Ratings;
  hoverId: string;
  onHover: (id: string) => void;
};

export function FlavourMap({ ratings, hoverId, onHover }: Props) {
  // Dot size tracks score where there is one; unrated cans stay small and
  // faint rather than pretending to a size they haven't earned.
  const scores = DRINKS.map((d) => scoreFor(d, ratings)).filter(
    (v): v is number => v !== null,
  );
  const lo = scores.length ? Math.min(...scores) : 0;
  const hi = scores.length ? Math.max(...scores) : 10;
  const span = Math.max(0.4, hi - lo);

  const rankOf = rankMap(ratings);
  const hovered = DRINKS.find((d) => d.id === hoverId) ?? DRINKS[0];

  return (
    <section id="map" className="section">
      <div className="wrap">
        <SectionHeader num="04" title="Flavour map" />
        <p className="lede">
          Sugar across, caffeine intensity up &mdash; both from the nutrition
          panel, not opinion. Dot size is its league score once rated. Hover for
          the read-out.
        </p>

        <div className="mapBox">
          <span className="mapAxisH" aria-hidden="true" />
          <span className="mapAxisV" aria-hidden="true" />
          <span
            className="mapAxisLabel"
            style={{ left: 18, top: "50%", transform: "translateY(-50%)" }}
          >
            No sugar
          </span>
          <span
            className="mapAxisLabel"
            style={{ right: 18, top: "50%", transform: "translateY(-50%)" }}
          >
            Sugary
          </span>
          <span
            className="mapAxisLabel"
            style={{ top: 14, left: "50%", transform: "translateX(-50%)" }}
          >
            Intense
          </span>
          <span
            className="mapAxisLabel"
            style={{ bottom: 14, left: "50%", transform: "translateX(-50%)" }}
          >
            Mild
          </span>

          {DRINKS.map((d) => {
            const score = scoreFor(d, ratings);
            const t = score === null ? 0 : (score - lo) / span;
            const size = score === null ? 11 : Math.round(14 + t * 34);
            return (
              <button
                key={d.id}
                type="button"
                className="mapDot"
                onMouseEnter={() => onHover(d.id)}
                onFocus={() => onHover(d.id)}
                onClick={() => onHover(d.id)}
                aria-label={`${d.name}, score ${fmtScore(score)}`}
                style={{
                  // sweet 0-100 -> 8-92% across, nuke 0-100 -> 92-8% up
                  left: `${8 + d.sweet * 0.84}%`,
                  top: `${92 - d.nuke * 0.84}%`,
                  zIndex: Math.round(t * 20),
                }}
              >
                <span
                  className="mapDotInner"
                  style={{
                    border: `2px solid ${d.id === hoverId ? "#F2F4EE" : "#0A0B09"}`,
                    background: d.color,
                    opacity: score === null ? 0.42 : 0.6 + t * 0.4,
                    width: size,
                    height: size,
                  }}
                />
              </button>
            );
          })}

          <div className="mapReadout">
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: "var(--dim)",
              }}
            >
              Read-out
            </div>
            <div
              className="display"
              style={{
                fontSize: 20,
                textTransform: "uppercase",
                letterSpacing: "-.02em",
                margin: "6px 0 4px",
              }}
            >
              {hovered.name}
            </div>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--muted)" }}
            >
              {hovered.caf} mg ·{" "}
              {hovered.sug === null ? "sugar n/a" : `${hovered.sug} g sugar`} ·{" "}
              {caffeineDensity(hovered).toFixed(0)} mg/100ml ·{" "}
              {rankOf[hovered.id] ? `rank #${rankOf[hovered.id]}` : "unrated"}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
