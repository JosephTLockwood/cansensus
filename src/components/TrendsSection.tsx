import { DRINKS } from "@/lib/data";
import { blended, sparkline } from "@/lib/scoring";
import type { Drink, Ratings } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

export function TrendsSection({ ratings }: { ratings: Ratings }) {
  const byMovement = (a: Drink, b: Drink) =>
    blended(b, ratings) - b.prev - (blended(a, ratings) - a.prev);

  const risers = [...DRINKS].sort(byMovement).slice(0, 5);
  const fallers = [...DRINKS].sort((a, b) => byMovement(b, a)).slice(0, 5);
  const divisive = [...DRINKS].sort((a, b) => b.sd - a.sd).slice(0, 4);

  return (
    <section id="trends" className="section">
      <div className="wrap">
        <SectionHeader num="03" title="Form guide" />

        <div className="grid300">
          <MoverCard
            title="↑ Climbing"
            titleColor="var(--lime)"
            drinks={risers}
            ratings={ratings}
            changeColor="var(--lime)"
            sign
          />
          <MoverCard
            title="↓ Sliding"
            titleColor="var(--orange)"
            drinks={fallers}
            ratings={ratings}
            changeColor="var(--orange)"
          />

          <div className="divisiveCard">
            <div
              className="label"
              style={{ color: "var(--gold)", marginBottom: 16 }}
            >
              ⚡ Hot takes — most divisive
            </div>
            {divisive.map((d) => {
              // Rough love/hate split implied by the rating spread and score.
              const hate = Math.round(d.sd * 16);
              const love = Math.round(d.sd * 13 + blended(d, ratings) * 2);
              const mid = Math.max(0, 100 - hate - love);
              return (
                <div key={d.id} className="divisiveRow">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600 }}>
                      {d.name}
                    </span>
                    <span
                      className="mono"
                      style={{ fontSize: 11, color: "var(--gold)" }}
                    >
                      ±{d.sd.toFixed(1)}
                    </span>
                  </div>
                  <div className="splitBar">
                    <span
                      style={{ background: "#FF5B24", width: `${hate}%` }}
                    />
                    <span
                      style={{ background: "#2C3024", width: `${mid}%` }}
                    />
                    <span
                      style={{ background: "#D8FF3E", width: `${love}%` }}
                    />
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 10, color: "var(--dim)", marginTop: 6 }}
                  >
                    {hate}% hate it · {love}% love it
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function MoverCard({
  title,
  titleColor,
  drinks,
  ratings,
  changeColor,
  sign = false,
}: {
  title: string;
  titleColor: string;
  drinks: Drink[];
  ratings: Ratings;
  changeColor: string;
  /** risers need an explicit "+", fallers already carry the minus sign */
  sign?: boolean;
}) {
  return (
    <div className="card">
      <div className="label" style={{ color: titleColor, marginBottom: 16 }}>
        {title}
      </div>
      {drinks.map((d) => {
        const change = blended(d, ratings) - d.prev;
        return (
          <div key={d.id} className="trendRow">
            <span
              className="trendSwatch"
              style={{ background: d.color }}
              aria-hidden="true"
            />
            <span className="trendName">{d.name}</span>
            <svg
              viewBox="0 0 140 44"
              style={{ width: 96, height: 26, flex: "none" }}
              aria-hidden="true"
            >
              <polyline
                points={sparkline(d, ratings)}
                fill="none"
                stroke={d.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
              />
            </svg>
            <span className="trendChange" style={{ color: changeColor }}>
              {sign ? "+" : ""}
              {change.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
