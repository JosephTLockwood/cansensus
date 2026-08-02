"use client";

import { useMemo, useState } from "react";
import { COLS, DRINKS, FILTERS, SLIDER_DEFS } from "@/lib/data";
import { blended, history, prevRankMap, rankMap, sparkline } from "@/lib/scoring";
import type { Drink, Ratings, SortKey } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

type Props = {
  ratings: Ratings;
  /** Loads a can into the rate form and scrolls the user back up to it. */
  onRateThis: (id: string) => void;
};

export function StandingsSection({ ratings, onRateThis }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const rankOf = useMemo(() => rankMap(ratings), [ratings]);
  const prevRank = useMemo(() => prevRankMap(), []);

  const rows = useMemo(() => {
    const filtered = DRINKS.filter((d) =>
      activeFilters.every((key) => {
        const f = FILTERS.find((x) => x.key === key);
        return f ? f.test(d, ratings) : true;
      }),
    );

    const value: Record<SortKey, (d: Drink) => number | string> = {
      // negated so the shared "descending" comparator puts #1 on top
      rank: (d) => -rankOf[d.id],
      name: (d) => d.name,
      score: (d) => blended(d, ratings),
      votes: (d) => d.v + (ratings[d.id] ? 1 : 0),
      caf: (d) => d.caf,
      sug: (d) => d.sug,
      ppd: (d) => d.caf / d.price,
      delta: (d) => prevRank[d.id] - rankOf[d.id],
    };
    const get = value[sortKey];

    return [...filtered].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      const cmp =
        typeof x === "string" && typeof y === "string"
          ? x.localeCompare(y)
          : (y as number) - (x as number);
      return cmp * sortDir;
    });
  }, [activeFilters, prevRank, rankOf, ratings, sortDir, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const toggleFilter = (key: string) =>
    setActiveFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );

  const sortedLabel = COLS.find((c) => c.key === sortKey)?.label ?? "";

  return (
    <section id="table" className="section">
      <div className="wrap">
        <SectionHeader num="02" title="Standings" />

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            margin: "22px 0 18px",
            alignItems: "center",
          }}
        >
          {FILTERS.map((f) => {
            const on = activeFilters.includes(f.key);
            return (
              <button
                key={f.key}
                type="button"
                className="filterChip"
                onClick={() => toggleFilter(f.key)}
                aria-pressed={on}
                style={{
                  border: `1px solid ${on ? "#D8FF3E" : "#23261E"}`,
                  background: on ? "rgba(216,255,62,.12)" : "transparent",
                  color: on ? "#D8FF3E" : "#8A9179",
                }}
              >
                {f.label}
              </button>
            );
          })}
          <span
            className="mono"
            style={{ fontSize: 11, color: "var(--dim)", marginLeft: "auto" }}
          >
            {rows.length} of {DRINKS.length} cans · sorted by {sortedLabel}
          </span>
        </div>

        <div className="tableWrap">
          <div className="tableGrid tableHead">
            {COLS.map((c) => (
              <button
                key={c.key}
                type="button"
                className={`colBtn${c.ext ? " colExt" : ""}`}
                onClick={() => toggleSort(c.key)}
                style={{
                  textAlign: c.align,
                  color: sortKey === c.key ? "#D8FF3E" : "#8A9179",
                }}
              >
                {c.label}
                {sortKey === c.key ? (sortDir === 1 ? " ▾" : " ▴") : ""}
              </button>
            ))}
          </div>

          {rows.map((d) => (
            <Row
              key={d.id}
              drink={d}
              ratings={ratings}
              rank={rankOf[d.id]}
              delta={prevRank[d.id] - rankOf[d.id]}
              open={d.id === openId}
              onToggle={() => setOpenId(openId === d.id ? null : d.id)}
              onRateThis={() => onRateThis(d.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Row({
  drink: d,
  ratings,
  rank,
  delta,
  open,
  onToggle,
  onRateThis,
}: {
  drink: Drink;
  ratings: Ratings;
  rank: number;
  delta: number;
  open: boolean;
  onToggle: () => void;
  onRateThis: () => void;
}) {
  const score = blended(d, ratings);
  const mine = ratings[d.id];
  const deltaColor =
    delta === 0 ? "#5E6552" : delta > 0 ? "#D8FF3E" : "#FF5B24";

  return (
    <div
      className="row"
      style={{ background: open ? "var(--panel-open)" : "transparent" }}
    >
      <button
        type="button"
        className="tableGrid rowInner"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={`${d.name}, rank ${rank}, score ${score.toFixed(2)}`}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="rowRank"
            style={{ color: rank <= 3 ? "#D8FF3E" : "#4A5040" }}
          >
            {rank}
          </span>
        </span>

        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
          }}
        >
          <span
            className="rowSwatch"
            style={{
              background: `linear-gradient(160deg,${d.color},rgba(0,0,0,.55))`,
            }}
            aria-hidden="true"
          />
          <span style={{ minWidth: 0 }}>
            <span className="rowName" style={{ display: "block" }}>
              {d.name}
            </span>
            <span className="rowSub" style={{ display: "block" }}>
              {d.sub} · {d.cal} cal
            </span>
          </span>
        </span>

        <span style={{ display: "block" }}>
          <span
            style={{ display: "flex", alignItems: "baseline", gap: 8 }}
          >
            <span
              className="display"
              style={{ fontSize: 17, color: "var(--lime)" }}
            >
              {score.toFixed(2)}
            </span>
            <span
              className="mono"
              style={{ fontSize: 10, color: "var(--dim)" }}
            >
              {mine ? `you ${mine.score.toFixed(1)}` : ""}
            </span>
          </span>
          <span className="bar" style={{ display: "block" }}>
            <span
              className="barFill"
              style={{
                display: "block",
                background: d.color,
                width: `${Math.round(score * 10)}%`,
              }}
            />
          </span>
        </span>

        <span className="rowNum colExt">
          {(d.v + (mine ? 1 : 0)).toLocaleString()}
        </span>
        <span className="rowNum colExt">{d.caf} mg</span>
        <span className="rowNum colExt">{d.sug} g</span>
        <span className="rowNum colExt">{Math.round(d.caf / d.price)}</span>
        <span
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 700,
            textAlign: "right",
            color: deltaColor,
          }}
        >
          {delta === 0 ? "—" : delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`}
        </span>
      </button>

      {open && (
        <div className="rowDetail grid230">
          <div>
            <div className="label" style={{ marginBottom: 12 }}>
              Score breakdown
            </div>
            {breakdownFor(d, score, mine).map((b) => (
              <div key={b.label} className="breakdownRow">
                <span className="breakdownLabel">{b.label}</span>
                <span
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 99,
                    background: "var(--line)",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      background: b.color,
                      width: `${b.pct}%`,
                    }}
                  />
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--text)",
                    width: 30,
                    textAlign: "right",
                  }}
                >
                  {b.val}
                </span>
              </div>
            ))}
          </div>

          <div>
            <div className="label" style={{ marginBottom: 12 }}>
              8-week form
            </div>
            <svg
              viewBox="0 0 140 44"
              style={{ width: "100%", height: 52, overflow: "visible" }}
              role="img"
              aria-label={`${d.name} score trend over eight weeks`}
            >
              <polyline
                points={sparkline(d, ratings)}
                fill="none"
                stroke={d.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </svg>
            <div
              className="mono"
              style={{ fontSize: 11, color: "var(--dim)", marginTop: 6 }}
            >
              {formNote(d, ratings)}
            </div>
          </div>

          <div>
            <div className="label" style={{ marginBottom: 12 }}>
              Notes
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--muted)",
                textWrap: "pretty",
              }}
            >
              {d.note}
            </div>
            <button
              type="button"
              className="btnOutline"
              style={{ marginTop: 14 }}
              onClick={onRateThis}
            >
              Rate this one
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formNote(d: Drink, ratings: Ratings) {
  const h = history(d, ratings);
  const trend = h[7] - h[0];
  return `${trend >= 0 ? "+" : ""}${trend.toFixed(2)} over 8 weeks · ±${d.sd.toFixed(1)} spread`;
}

/**
 * Once you have rated a can, the breakdown shows your own four scores.
 * Until then it shows the crowd's implied profile, derived from the
 * nutrition panel and the spread of ratings.
 */
function breakdownFor(
  d: Drink,
  score: number,
  mine: Ratings[string] | undefined,
) {
  if (mine) {
    return SLIDER_DEFS.map((s) => ({
      label: `your ${s.label}`,
      val: String(mine.vals[s.key]),
      pct: mine.vals[s.key] * 10,
      color: d.color,
    }));
  }
  return [
    {
      label: "Taste",
      val: (score * 0.98).toFixed(1),
      pct: Math.round(score * 9.8),
      color: d.color,
    },
    {
      label: "Kick",
      val: ((d.caf / 300) * 10).toFixed(1),
      pct: Math.round((d.caf / 300) * 100),
      color: "#3EE8FF",
    },
    {
      label: "Aftertaste",
      val: (10 - d.sd * 2).toFixed(1),
      pct: Math.round((10 - d.sd * 2) * 10),
      color: "#B77BFF",
    },
    {
      label: "Value",
      val: (d.caf / d.price / 9).toFixed(1),
      pct: Math.round(d.caf / d.price / 0.9),
      color: "#FFC53E",
    },
  ];
}
