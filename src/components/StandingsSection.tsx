"use client";

import { useMemo, useState } from "react";
import { COLS, FILTERS, SLIDER_DEFS, tagsFor } from "@/lib/data";
import {
  caffeineDensity,
  fmtScore,
  prevRankMap,
  rankMap,
  scoreFor,
  sparkline,
  history,
  votesFor,
} from "@/lib/scoring";
import type { Drink, Ratings, SortKey } from "@/lib/types";
import { CanImage } from "./CanImage";
import { SectionHeader } from "./SectionHeader";

type Props = {
  drinks: Drink[];
  ratings: Ratings;
  /** Loads a can into the rate form and scrolls the user back up to it. */
  onRateThis: (id: string) => void;
};

export function StandingsSection({ drinks, ratings, onRateThis }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const rankOf = useMemo(() => rankMap(drinks, ratings), [drinks, ratings]);
  const prevRank = useMemo(() => prevRankMap(drinks), [drinks]);
  const ratedCount = Object.keys(ratings).length;

  const rows = useMemo(() => {
    const filtered = drinks.filter((d) =>
      activeFilters.every((key) => {
        const f = FILTERS.find((x) => x.key === key);
        return f ? f.test(d, ratings) : true;
      }),
    );

    // Unscored drinks always sort last, whichever column is active — a can
    // nobody has rated has no business appearing above one that has been.
    const value: Record<SortKey, (d: Drink) => number | string | null> = {
      rank: (d) => (rankOf[d.id] ? -rankOf[d.id] : null),
      name: (d) => d.name,
      score: (d) => scoreFor(d, ratings),
      votes: (d) => votesFor(d, ratings),
      caf: (d) => d.caf,
      sug: (d) => d.sug,
      delta: (d) =>
        rankOf[d.id] && prevRank[d.id] ? prevRank[d.id] - rankOf[d.id] : null,
    };
    const get = value[sortKey];

    return [...filtered].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === null && y === null) return a.name.localeCompare(b.name);
      if (x === null) return 1;
      if (y === null) return -1;
      const cmp =
        typeof x === "string" && typeof y === "string"
          ? x.localeCompare(y)
          : (y as number) - (x as number);
      return cmp * sortDir;
    });
  }, [activeFilters, drinks, prevRank, rankOf, ratings, sortDir, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
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
        <p className="lede" style={{ margin: "12px 0 0" }}>
          {ratedCount === 0
            ? "Nobody has rated anything yet, so there is no table to show. Rate a can and it appears here — this becomes the crowd table once sign-in and the database land."
            : `Ranked by your ratings. ${ratedCount} of ${drinks.length} cans rated — unrated cans sit below the line.`}
        </p>

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
            {rows.length} of {drinks.length} cans · sorted by {sortedLabel}
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
              rank={rankOf[d.id] ?? null}
              delta={
                rankOf[d.id] && prevRank[d.id]
                  ? prevRank[d.id] - rankOf[d.id]
                  : null
              }
              open={d.id === openId}
              onToggle={() => setOpenId(openId === d.id ? null : d.id)}
              onRateThis={() => onRateThis(d.id)}
            />
          ))}
        </div>

        <p
          className="mono"
          style={{ fontSize: 10, color: "var(--faint)", marginTop: 14 }}
        >
          Nutrition and photography from Open Food Facts. Figures are approximate
          per listed serving.
        </p>
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
  rank: number | null;
  delta: number | null;
  open: boolean;
  onToggle: () => void;
  onRateThis: () => void;
}) {
  const score = scoreFor(d, ratings);
  const mine = ratings[d.id];
  const deltaColor =
    delta === null || delta === 0
      ? "#5E6552"
      : delta > 0
        ? "#D8FF3E"
        : "#FF5B24";

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
        aria-label={`${d.name}, ${rank ? `rank ${rank}` : "not rated"}`}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            className="rowRank"
            style={{
              color: rank === null ? "#3A4030" : rank <= 3 ? "#D8FF3E" : "#4A5040",
              fontSize: rank === null ? 14 : 20,
            }}
          >
            {rank ?? "—"}
          </span>
        </span>

        <span
          style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}
        >
          <CanImage drink={d} variant="row" />
          <span style={{ minWidth: 0 }}>
            <span className="rowName" style={{ display: "block" }}>
              {d.name}
            </span>
            <span className="rowSub" style={{ display: "block" }}>
              {d.sub}
              {d.cal === null ? "" : ` · ${d.cal} cal`}
            </span>
          </span>
        </span>

        <span style={{ display: "block" }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              className="display"
              style={{
                fontSize: 17,
                color: score === null ? "var(--rank-dim)" : "var(--lime)",
              }}
            >
              {fmtScore(score)}
            </span>
            <span className="mono" style={{ fontSize: 10, color: "var(--dim)" }}>
              {mine ? `you ${mine.score.toFixed(1)}` : ""}
            </span>
          </span>
          <span className="bar" style={{ display: "block" }}>
            {score !== null && (
              <span
                className="barFill"
                style={{
                  display: "block",
                  background: d.color,
                  width: `${Math.round(score * 10)}%`,
                }}
              />
            )}
          </span>
        </span>

        <span className="rowNum colExt">
          {votesFor(d, ratings) || "—"}
        </span>
        <span className="rowNum colExt">{d.caf} mg</span>
        <span className="rowNum colExt">
          {d.sug === null ? "—" : `${d.sug} g`}
        </span>
        <span
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 700,
            textAlign: "right",
            color: deltaColor,
          }}
        >
          {delta === null || delta === 0
            ? "—"
            : delta > 0
              ? `▲ ${delta}`
              : `▼ ${Math.abs(delta)}`}
        </span>
      </button>

      {open && <RowDetail drink={d} mine={mine} onRateThis={onRateThis} />}
    </div>
  );
}

function RowDetail({
  drink: d,
  mine,
  onRateThis,
}: {
  drink: Drink;
  mine: Ratings[string] | undefined;
  onRateThis: () => void;
}) {
  const points = history();
  const spark = sparkline(points);

  return (
    <div className="rowDetail grid230">
      <div>
        <div className="label" style={{ marginBottom: 12 }}>
          {mine ? "Your breakdown" : "Score breakdown"}
        </div>
        {mine ? (
          SLIDER_DEFS.map((s) => (
            <div key={s.key} className="breakdownRow">
              <span className="breakdownLabel">{s.label}</span>
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
                    background: d.color,
                    width: `${mine.vals[s.key] * 10}%`,
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
                {mine.vals[s.key]}
              </span>
            </div>
          ))
        ) : (
          <p className="emptyNote">
            No breakdown yet — the four scores appear here once you rate this
            can.
          </p>
        )}
      </div>

      <div>
        <div className="label" style={{ marginBottom: 12 }}>
          Weekly form
        </div>
        {spark ? (
          <svg
            viewBox="0 0 140 44"
            style={{ width: "100%", height: 52, overflow: "visible" }}
            role="img"
            aria-label={`${d.name} score trend`}
          >
            <polyline
              points={spark}
              fill="none"
              stroke={d.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <p className="emptyNote">
            Form needs weekly snapshots. The first line appears after Cansensus
            has been running a week.
          </p>
        )}
      </div>

      <div>
        <div className="label" style={{ marginBottom: 12 }}>
          The can
        </div>
        <dl className="factList">
          <Fact label="Brand" value={d.brand} />
          <Fact label="Size" value={`${d.sub} (${d.ml} ml)`} />
          <Fact
            label="Intensity"
            value={`${caffeineDensity(d).toFixed(0)} mg / 100 ml`}
          />
          <Fact label="Barcode" value={d.barcode} />
        </dl>
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}
        >
          {tagsFor(d).map((t) => (
            <span key={t} className="tag">
              {t}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="btnOutline"
          style={{ marginTop: 14 }}
          onClick={onRateThis}
        >
          {mine ? "Update your rating" : "Rate this one"}
        </button>
      </div>
    </div>
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
