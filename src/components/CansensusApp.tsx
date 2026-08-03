"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrinks } from "@/lib/use-drinks";
import { localRatingsSource, type RatingsSource } from "@/lib/ratings-source";
import {
  createSupabaseRatingsSource,
  migrateLocalRatings,
} from "@/lib/supabase-ratings-source";
import { getSupabase } from "@/lib/supabase/client";
import { useAuthContext } from "./AuthProvider";
import { SubmitCanDialog } from "./SubmitCanDialog";
import { compositeScore, DEFAULT_VALS, fmtScore, ranked, scoreFor } from "@/lib/scoring";
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


/**
 * Owns the state every section reads: the user's ratings, which can is loaded
 * into the form, and the current form values. Section-local concerns (table
 * sort, which row is expanded) stay inside their own components.
 */
export function CansensusApp({
  ratingsSource,
}: {
  /** Override for tests; normally chosen from the session below. */
  ratingsSource?: RatingsSource;
}) {
  const { session, profile } = useAuthContext();
  const { drinks, reloadDrinks } = useDrinks();
  const [submitOpen, setSubmitOpen] = useState(false);
  const userId = profile ? session?.user?.id : undefined;

  // Signed in with a handle -> Postgres. Otherwise this device's localStorage,
  // so an anonymous visitor can still rate cans and keep them.
  const source = useMemo<RatingsSource>(() => {
    if (ratingsSource) return ratingsSource;
    const supabase = getSupabase();
    if (supabase && userId) return createSupabaseRatingsSource(supabase, userId);
    return localRatingsSource;
  }, [ratingsSource, userId]);

  const { ratings, rate, reload } = useRatings(source);

  const [selId, setSelId] = useState(drinks[0]?.id ?? "");
  const [vals, setVals] = useState<Vals>(DEFAULT_VALS);
  const [hoverId, setHoverId] = useState(drinks[0]?.id ?? "");
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

  // Anyone who rated cans before accounts existed shouldn't lose them for
  // having shown up early. Runs once per sign-in; server rows win on conflict.
  const migrated = useRef(false);
  useEffect(() => {
    if (!userId || migrated.current) return;
    migrated.current = true;
    const handle = profile?.handle;
    void migrateLocalRatings(source).then(async (moved) => {
      if (moved === 0) return;
      await reload();
      flash(
        `Moved ${moved} earlier rating${moved === 1 ? "" : "s"} into @${handle}`,
      );
    });
  }, [flash, profile?.handle, reload, source, userId]);

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

  const selected = drinks.find((d) => d.id === selId) ?? drinks[0];

  const submit = useCallback(() => {
    const score = compositeScore(vals);
    const rating = { vals: { ...vals }, score };

    // Compare the table before and after so the toast can report the move.
    const before = ranked(drinks, ratings).findIndex((d) => d.id === selId);
    const after = ranked(drinks, { ...ratings, [selId]: rating }).findIndex(
      (d) => d.id === selId,
    );
    const move =
      before === after ? "holds at" : after < before ? "climbs to" : "drops to";

    rate(selId, rating);
    flash(
      `${selected?.name ?? "Can"} — ${score.toFixed(2)} · ${move} #${after + 1}`,
    );
  }, [drinks, flash, rate, ratings, selId, selected, vals]);

  const roulette = useCallback(() => {
    const unrated = drinks.filter((d) => !ratings[d.id]);
    const pool = unrated.length ? unrated : drinks;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    select(pick.id);
    flash(`Roulette says: ${pick.name}`);
  }, [drinks, flash, ratings, select]);

  /** From the standings: load the can, then bring the form back into view. */
  const rateThis = useCallback(
    (id: string) => {
      select(id);
      flash(`Loaded ${drinks.find((d) => d.id === id)?.name} into the form`);
      document
        .getElementById("rate")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [drinks, flash, select],
  );

  const changeVal = useCallback((key: SliderKey, value: number) => {
    setVals((prev) => ({ ...prev, [key]: value }));
  }, []);

  const order = useMemo(() => ranked(drinks, ratings), [drinks, ratings]);

  // Only cans with a real score belong in the ticker. With none rated it
  // advertises the catalog instead of inventing a top eight.
  const tickerText = useMemo(() => {
    const scored = order.filter((d) => scoreFor(d, ratings) !== null);
    if (!scored.length) {
      return (
        `${drinks.length} cans in the catalog  •  real caffeine + sugar from ` +
        `Open Food Facts  •  rate one to start the table  •  `
      );
    }
    return (
      scored
        .slice(0, 8)
        .map(
          (d, i) => `#${i + 1} ${d.name}  ${fmtScore(scoreFor(d, ratings))}`,
        )
        .join("     •     ") + "     •     "
    );
  }, [drinks.length, order, ratings]);

  const myCount = Object.keys(ratings).length;
  const brandCount = new Set(drinks.map((d) => d.brand)).size;

  return (
    <div className="shell">
      <Hero
        drinkCount={drinks.length}
        brandCount={brandCount}
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
        onAddCan={() => setSubmitOpen(true)}
      />
      <StandingsSection
        drinks={drinks}
        ratings={ratings}
        onRateThis={rateThis}
      />
      <TrendsSection drinks={drinks} ratings={ratings} />
      <FlavourMap
        drinks={drinks}
        ratings={ratings}
        hoverId={hoverId}
        onHover={setHoverId}
      />
      <LabSection drinks={drinks} ratings={ratings} />
      <TastersSection drinks={drinks} ratings={ratings} />
      <SiteFooter />
      {submitOpen && (
        <SubmitCanDialog
          onClose={() => setSubmitOpen(false)}
          onSubmitted={(message) => {
            flash(message);
            void reloadDrinks();
          }}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}
