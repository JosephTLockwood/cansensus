"use client";

import { DRINKS } from "@/lib/data";
import { blended, rankMap } from "@/lib/scoring";
import type { Ratings } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

type Props = {
  ratings: Ratings;
  hoverId: string;
  onHover: (id: string) => void;
};

export function FlavourMap({ ratings, hoverId, onHover }: Props) {
  const scores = DRINKS.map((d) => blended(d, ratings));
  const lo = Math.min(...scores);
  const hi = Math.max(...scores);
  const span = Math.max(0.4, hi - lo);

  const rankOf = rankMap(ratings);
  const hovered = DRINKS.find((d) => d.id === hoverId) ?? DRINKS[0];

  return (
    <section id="map" className="section">
      <div className="wrap">
        <SectionHeader num="04" title="Flavour map" />
        <p className="lede">
          Sweet to tart across, mild to nuclear up. Dot size is crowd score.
          Hover for the read-out.
        </p>

        <div className="mapBox">
          <span className="mapAxisH" aria-hidden="true" />
          <span className="mapAxisV" aria-hidden="true" />
          <span
            className="mapAxisLabel"
            style={{ left: 18, top: "50%", transform: "translateY(-50%)" }}
          >
            Tart
          </span>
          <span
            className="mapAxisLabel"
            style={{ right: 18, top: "50%", transform: "translateY(-50%)" }}
          >
            Sweet
          </span>
          <span
            className="mapAxisLabel"
            style={{ top: 14, left: "50%", transform: "translateX(-50%)" }}
          >
            Nuclear
          </span>
          <span
            className="mapAxisLabel"
            style={{ bottom: 14, left: "50%", transform: "translateX(-50%)" }}
          >
            Mild
          </span>

          {DRINKS.map((d) => {
            const t = (blended(d, ratings) - lo) / span;
            const size = Math.round(11 + t * 39);
            return (
              <button
                key={d.id}
                type="button"
                className="mapDot"
                onMouseEnter={() => onHover(d.id)}
                onFocus={() => onHover(d.id)}
                onClick={() => onHover(d.id)}
                aria-label={`${d.name}, score ${blended(d, ratings).toFixed(2)}`}
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
                    opacity: 0.5 + t * 0.5,
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
              {blended(hovered, ratings).toFixed(2)} · {hovered.caf} mg ·{" "}
              {hovered.sug} g sugar · rank #{rankOf[hovered.id]}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
