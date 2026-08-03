"use client";

import { useCallback, useEffect, useState } from "react";
import { DRINKS as STATIC_DRINKS } from "./data";
import { getSupabase } from "./supabase/client";
import type { Drink } from "./types";

type DrinkRow = {
  id: string;
  barcode: string | null;
  name: string;
  brand: string;
  sub: string;
  ml: number;
  caf: number;
  sug: number | string | null;
  cal: number | null;
  sweet: number;
  nuke: number;
  color: string;
  image_url: string | null;
  image_small_url: string | null;
  source: string | null;
  us: boolean;
  price: number | string | null;
};

type StatsRow = {
  drink_id: string;
  score: number | string | null;
  votes: number;
  sd: number | string | null;
};

const nOrNull = (v: number | string | null | undefined) =>
  v === null || v === undefined ? null : Number(v);

/**
 * Reads the live catalog. Returns null on any failure, which the caller treats
 * as "keep what you have" rather than emptying the page.
 *
 * Kept free of setState so the effect below can await it without the React
 * Compiler flagging a synchronous state update inside an effect body.
 */
async function fetchLiveDrinks(): Promise<Drink[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const [{ data: rows, error }, { data: stats }] = await Promise.all([
    supabase
      .from("drinks")
      .select(
        "id,barcode,name,brand,sub,ml,caf,sug,cal,sweet,nuke,color,image_url,image_small_url,source,us,price",
      )
      .eq("status", "live")
      .order("brand")
      .order("name"),
    supabase.from("drink_stats").select("drink_id,score,votes,sd"),
  ]);

  if (error || !rows || rows.length === 0) return null;

  const statsById = new Map<string, StatsRow>();
  for (const s of (stats ?? []) as StatsRow[]) statsById.set(s.drink_id, s);

  return (rows as DrinkRow[]).map((r) => {
    const s = statsById.get(r.id);
    const score = nOrNull(s?.score);
    return {
      id: r.id,
      barcode: r.barcode ?? r.id,
      name: r.name,
      brand: r.brand,
      sub: r.sub,
      ml: r.ml,
      caf: r.caf,
      sug: nOrNull(r.sug),
      cal: r.cal,
      sweet: r.sweet,
      nuke: r.nuke,
      color: r.color,
      imageUrl: r.image_url ?? "",
      imageSmallUrl: r.image_small_url,
      source: r.source ?? "",
      us: r.us,
      price: nOrNull(r.price),
      crowd:
        score !== null && s
          ? { score, votes: s.votes, sd: nOrNull(s.sd) ?? 0, prevScore: null }
          : null,
    };
  });
}

/**
 * The live catalog.
 *
 * Starts from the build-time JSON so the first paint is populated and the page
 * still works with no network and no Supabase — then swaps in whatever is
 * actually live in Postgres. Without this a submitted can would sit in the
 * database invisibly, because the catalog was a static import.
 *
 * Crowd stats are joined in from drink_stats, so `crowd` becomes non-null the
 * moment anyone rates anything and the UI stops saying "—" on its own.
 */
export function useDrinks() {
  const [drinks, setDrinks] = useState<Drink[]>(STATIC_DRINKS);
  const [live, setLive] = useState(false);

  const reloadDrinks = useCallback(async () => {
    const next = await fetchLiveDrinks();
    if (next) {
      setDrinks(next);
      setLive(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const next = await fetchLiveDrinks();
      if (!active || !next) return;
      setDrinks(next);
      setLive(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  return { drinks, live, reloadDrinks };
}
