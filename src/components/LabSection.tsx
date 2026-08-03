import { CAFFEINE_BANDS } from "@/lib/data";
import { averageOf, caffeineDensity } from "@/lib/scoring";
import type { Drink, Ratings } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

type Bar = { label: string; val: string; pct: number; color: string };
type LabCard = { title: string; sub: string; bars: Bar[]; verdict: string };

export function LabSection({ drinks, ratings }: { drinks: Drink[]; ratings: Ratings }) {
  const cards = buildCards(drinks, ratings);

  return (
    <section id="lab" className="section">
      <div className="wrap">
        <SectionHeader num="05" title="The lab" />
        <p className="lede">
          What the nutrition panel says about the league, and what your own
          ratings say back. Price-based analysis is missing on purpose &mdash;
          Open Food Facts carries no prices, so mg-per-dollar has no honest
          source until people submit them.
        </p>

        <div className="grid280">
          {cards.map((card) => (
            <div key={card.title} className="card">
              <div className="label" style={{ marginBottom: 4 }}>
                {card.title}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "var(--muted)",
                  marginBottom: 18,
                }}
              >
                {card.sub}
              </div>

              {card.bars.map((b) => (
                <div key={b.label} style={{ marginBottom: 12 }}>
                  <div
                    className="kv"
                    style={{ color: "var(--muted)", marginBottom: 5 }}
                  >
                    <span>{b.label}</span>
                    <span style={{ color: "var(--text)", fontWeight: 700 }}>
                      {b.val}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 9,
                      borderRadius: 99,
                      background: "var(--line)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 99,
                        background: b.color,
                        width: `${b.pct}%`,
                      }}
                    />
                  </div>
                </div>
              ))}

              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--lime)",
                  marginTop: 16,
                  lineHeight: 1.5,
                }}
              >
                {card.verdict}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * The correlations, each with its verdict written from the live numbers rather
 * than hard-coded, so the copy stays honest as ratings arrive.
 *
 * Two of these describe the catalog itself (sugar and caffeine distribution)
 * and work today. Anything that needs a score falls back to describing the
 * shape of the league rather than inventing a correlation, and the Value card
 * needs prices, which Open Food Facts does not carry at all.
 */
function buildCards(drinks: Drink[], ratings: Ratings): LabCard[] {
  const scored = drinks.filter((d) => ratings[d.id]);
  const rated = (d: Drink) => ratings[d.id]?.score ?? null;

  // --- sugar ---
  const zero = drinks.filter((d) => d.sug === 0);
  const full = drinks.filter((d) => d.sug !== null && d.sug > 0);
  const unknown = drinks.filter((d) => d.sug === null);
  const zeroAvg = averageOf(zero, rated);
  const fullAvg = averageOf(full, rated);

  let sugarVerdict: string;
  if (zeroAvg === null || fullAvg === null) {
    const pct = Math.round((zero.length / (zero.length + full.length)) * 100);
    sugarVerdict = `${pct}% of the cans with sugar data are zero-sugar — the reformulation era is the default now. Rate cans from both camps to see whether it actually tastes better.`;
  } else {
    const gap = Math.abs(zeroAvg - fullAvg);
    sugarVerdict =
      gap < 0.3
        ? `Near dead heat in your ratings — ${gap.toFixed(2)} points between them.`
        : zeroAvg > fullAvg
          ? `You score zero-sugar ${gap.toFixed(2)} points above full-sugar.`
          : `You score full-sugar ${gap.toFixed(2)} points above zero-sugar.`;
  }

  // --- caffeine ---
  const bandColors = ["#3EE8FF", "#D8FF3E", "#9AFF3E", "#FF5B24"];
  const bands = CAFFEINE_BANDS.map(([min, max, label], i) => {
    const group = drinks.filter((d) => d.caf >= min && d.caf < max);
    return { label, n: group.length, color: bandColors[i] };
  });
  const biggestBand = [...bands].sort((a, b) => b.n - a.n)[0];
  const maxBand = Math.max(...bands.map((b) => b.n), 1);
  const caffeineVerdict = `The league clusters in the ${biggestBand.label.toLowerCase()} band (${biggestBand.n} of ${drinks.length} cans). Whether more milligrams means more points needs ratings across every band.`;

  const cards: LabCard[] = [
    {
      title: "Sugar",
      sub: "How the catalog splits on sugar",
      verdict: sugarVerdict,
      bars: [
        {
          label: `Zero sugar (${zero.length})`,
          val: String(zero.length),
          pct: Math.round((zero.length / drinks.length) * 100),
          color: "#D8FF3E",
        },
        {
          label: `Has sugar (${full.length})`,
          val: String(full.length),
          pct: Math.round((full.length / drinks.length) * 100),
          color: "#FF5B24",
        },
        ...(unknown.length
          ? [
              {
                label: `No data (${unknown.length})`,
                val: "—",
                pct: Math.round((unknown.length / drinks.length) * 100),
                color: "#2C3024",
              },
            ]
          : []),
      ],
    },
    {
      title: "Caffeine",
      sub: "Cans per dose band",
      verdict: caffeineVerdict,
      bars: bands.map((b) => ({
        label: b.label,
        val: String(b.n),
        pct: Math.round((b.n / maxBand) * 100),
        color: b.color,
      })),
    },
    {
      title: "Intensity",
      sub: "Strongest caffeine per 100 ml",
      verdict:
        "Caffeine density is the one intensity measure that needs no opinion — it comes straight off the panel.",
      bars: [...drinks]
        .sort((a, b) => caffeineDensity(b) - caffeineDensity(a))
        .slice(0, 5)
        .map((d) => ({
          label: d.name,
          val: `${caffeineDensity(d).toFixed(0)} mg`,
          pct: Math.round((caffeineDensity(d) / 70) * 100),
          color: d.color,
        })),
    },
  ];

  // The Value card is deliberately absent rather than empty: Open Food Facts
  // carries no prices, so mg-per-dollar has no source until users submit them.
  if (scored.length >= 3) {
    cards.push({
      title: "Your palate",
      sub: `Across the ${scored.length} cans you have rated`,
      verdict:
        "Your own averages. These become a comparison against the crowd once sign-in lands.",
      bars: [
        {
          label: "Average score",
          val: (averageOf(scored, rated) ?? 0).toFixed(2),
          pct: Math.round(((averageOf(scored, rated) ?? 0) / 10) * 100),
          color: "#D8FF3E",
        },
        {
          label: "Average caffeine",
          val: `${Math.round(averageOf(scored, (d) => d.caf) ?? 0)} mg`,
          pct: Math.round(((averageOf(scored, (d) => d.caf) ?? 0) / 300) * 100),
          color: "#3EE8FF",
        },
      ],
    });
  }

  return cards;
}
