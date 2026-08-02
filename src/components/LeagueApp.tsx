"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DRINKS } from "@/lib/data";
import { localRatingsSource, type RatingsSource } from "@/lib/ratings-source";
import { blended, compositeScore, DEFAULT_VALS, ranked } from "@/lib/scoring";
import type { SliderKey, Vals } from "@/lib/types";
import { useRatings } from "@/lib/use-ratings";
import { FlavourMap } from "./FlavourMap";
import { Hero } from "./Hero";
import { LabSection } from "./LabSection";
import { RateSection } from "./RateSection";
import { SiteFooter } from "./SiteFooter";
import { StandingsSection } from "./StandingsSection";
import { TastersSection } from "./TastersSection";
import { Ticker } from "./Ticker";
import { Toast } from "./Toast";
import { TrendsSection } from "./TrendsSection";

const TOAST_MS = 2600;
const FIRST_PICK = "ala";

/**
 * Owns the state every section reads: the user's ratings, which can is loaded
 * into the form, and the current form values. Section-local concerns (table
 * sort, which row is expanded) stay inside their own components.
 */
export function LeagueApp({
  ratingsSource = localRatingsSource,
}: {
  ratingsSource?: RatingsSource;
}) {
  const { ratings, rate } = useRatings(ratingsSource);

  const [selId, setSelId] = useState(FIRST_PICK);
  const [vals, setVals] = useState<Vals>(DEFAULT_VALS);
  const [hoverId, setHoverId] = useState(FIRST_PICK);
  const [toast, setToast] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const flash = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), TOAST_MS);
  }, []);

  /** Load a can into the form, pre-filled with your previous scores if any. */
  const select = useCallback(
    (id: string) => {
      setSelId(id);
      setHoverId(id);
      const existing = ratings[id];
      setVals(existing ? { ...existing.vals } : DEFAULT_VALS);
    },
    [ratings],
  );

  const selected = DRINKS.find((d) => d.id === selId) ?? DRINKS[0];

  const submit = useCallback(() => {
    const score = compositeScore(vals);
    const rating = { vals: { ...vals }, score };

    // Compare the table before and after so the toast can report the move.
    const before = ranked(DRINKS, ratings).findIndex((d) => d.id === selId);
    const after = ranked(DRINKS, { ...ratings, [selId]: rating }).findIndex(
      (d) => d.id === selId,
    );
    const move =
      before === after ? "holds at" : after < before ? "climbs to" : "drops to";

    rate(selId, rating);
    flash(
      `${selected.name} — ${score.toFixed(2)} · ${move} #${after + 1}`,
    );
  }, [flash, rate, ratings, selId, selected.name, vals]);

  const roulette = useCallback(() => {
    const unrated = DRINKS.filter((d) => !ratings[d.id]);
    const pool = unrated.length ? unrated : DRINKS;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    select(pick.id);
    flash(`Roulette says: ${pick.name}`);
  }, [flash, ratings, select]);

  /** From the standings: load the can, then bring the form back into view. */
  const rateThis = useCallback(
    (id: string) => {
      select(id);
      flash(`Loaded ${DRINKS.find((d) => d.id === id)?.name} into the form`);
      document
        .getElementById("rate")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [flash, select],
  );

  const changeVal = useCallback((key: SliderKey, value: number) => {
    setVals((prev) => ({ ...prev, [key]: value }));
  }, []);

  const order = useMemo(() => ranked(DRINKS, ratings), [ratings]);

  const tickerText = useMemo(
    () =>
      order
        .slice(0, 8)
        .map(
          (d, i) => `#${i + 1} ${d.name}  ${blended(d, ratings).toFixed(2)}`,
        )
        .join("     •     ") + "     •     ",
    [order, ratings],
  );

  const myCount = Object.keys(ratings).length;
  const crowdVotes = DRINKS.reduce((a, d) => a + d.v, 0);

  return (
    <div className="shell">
      <Hero
        totalVotes={crowdVotes + myCount}
        drinkCount={DRINKS.length}
        myCount={myCount}
      />
      <Ticker text={tickerText} />
      <RateSection
        chipOrder={order}
        selected={selected}
        ratings={ratings}
        vals={vals}
        onSelect={select}
        onChangeVal={changeVal}
        onSubmit={submit}
        onRoulette={roulette}
      />
      <StandingsSection ratings={ratings} onRateThis={rateThis} />
      <TrendsSection ratings={ratings} />
      <FlavourMap ratings={ratings} hoverId={hoverId} onHover={setHoverId} />
      <LabSection ratings={ratings} />
      <TastersSection ratings={ratings} />
      <SiteFooter />
      <Toast message={toast} />
    </div>
  );
}
