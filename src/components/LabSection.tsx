import { CAFFEINE_BANDS, DRINKS } from "@/lib/data";
import { average, barPercent, blended } from "@/lib/scoring";
import type { Ratings } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

type Bar = { label: string; val: string; pct: number; color: string };
type LabCard = { title: string; sub: string; bars: Bar[]; verdict: string };

export function LabSection({ ratings }: { ratings: Ratings }) {
  const cards = buildCards(ratings);

  return (
    <section id="lab" className="section">
      <div className="wrap">
        <SectionHeader num="05" title="The lab" />
        <p className="lede">
          What actually correlates with a high score? Crowd ratings crossed
          against the nutrition panel.
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
 * The three correlations, each with its verdict written from the live numbers
 * rather than hard-coded — so the copy stays honest once your own ratings
 * start moving the averages.
 */
function buildCards(ratings: Ratings): LabCard[] {
  const score = (d: (typeof DRINKS)[number]) => blended(d, ratings);

  // --- sugar ---
  const zero = DRINKS.filter((d) => d.sug === 0);
  const full = DRINKS.filter((d) => d.sug > 0);
  const zeroAvg = average(zero, score);
  const fullAvg = average(full, score);
  const sugarGap = Math.abs(zeroAvg - fullAvg);
  const sugarVerdict =
    sugarGap < 0.08
      ? `Dead heat — ${sugarGap.toFixed(2)} points between them. Sugar is not the variable that decides this league.`
      : zeroAvg > fullAvg
        ? `Zero-sugar cans lead full-sugar by ${sugarGap.toFixed(2)} points. The reformulation era won.`
        : `Full-sugar cans still lead by ${sugarGap.toFixed(2)} points, off a much smaller field. The classics hold.`;

  // --- caffeine ---
  const bandColors = ["#3EE8FF", "#D8FF3E", "#9AFF3E", "#FF5B24"];
  const bands = CAFFEINE_BANDS.map(([min, max, label], i) => {
    const group = DRINKS.filter((d) => d.caf >= min && d.caf < max);
    return {
      label,
      n: group.length,
      avg: group.length ? average(group, score) : null,
      color: bandColors[i],
    };
  });
  const filled = bands.filter((b) => b.avg !== null) as {
    label: string;
    n: number;
    avg: number;
    color: string;
  }[];
  const best = [...filled].sort((a, b) => b.avg - a.avg)[0];
  const worst = [...filled].sort((a, b) => a.avg - b.avg)[0];
  const caffeineVerdict = `The sweet spot is ${best.label.toLowerCase()} at ${best.avg.toFixed(2)}. The ${worst.label.toLowerCase()} band is the weakest at ${worst.avg.toFixed(2)} — more milligrams is not more points.`;

  // --- value ---
  const byPrice = [...DRINKS].sort((a, b) => a.price - b.price);
  const half = Math.floor(byPrice.length / 2);
  const cheapAvg = average(byPrice.slice(0, half), score);
  const dearAvg = average(byPrice.slice(-half), score);
  const priceGap = Math.abs(cheapAvg - dearAvg);
  const valueVerdict =
    priceGap < 0.25
      ? `Price barely predicts score — ${priceGap.toFixed(2)} points separate the cheap half from the expensive half.`
      : cheapAvg > dearAvg
        ? `The cheaper half of the league out-scores the pricier half by ${priceGap.toFixed(2)} points. Paying more is not working.`
        : `The pricier half edges the cheap half by ${priceGap.toFixed(2)} points — the only place spending shows up.`;

  return [
    {
      title: "Sugar",
      sub: "Average crowd score by sugar content",
      verdict: sugarVerdict,
      bars: [
        {
          label: `Zero sugar (${zero.length})`,
          val: zeroAvg.toFixed(2),
          pct: barPercent(zeroAvg),
          color: "#D8FF3E",
        },
        {
          label: `Full sugar (${full.length})`,
          val: fullAvg.toFixed(2),
          pct: barPercent(fullAvg),
          color: "#FF5B24",
        },
      ],
    },
    {
      title: "Caffeine",
      sub: "Score by dose band — more is not better",
      verdict: caffeineVerdict,
      bars: bands.map((b) => ({
        label: `${b.label} (${b.n})`,
        val: b.avg === null ? "—" : b.avg.toFixed(2),
        pct: b.avg === null ? 0 : barPercent(b.avg),
        color: b.color,
      })),
    },
    {
      title: "Value",
      sub: "Caffeine milligrams per dollar",
      verdict: valueVerdict,
      bars: [...DRINKS]
        .sort((a, b) => b.caf / b.price - a.caf / a.price)
        .slice(0, 5)
        .map((d) => ({
          label: d.name,
          val: `${Math.round(d.caf / d.price)} mg/$`,
          pct: Math.round(d.caf / d.price / 1.25),
          color: d.color,
        })),
    },
  ];
}
