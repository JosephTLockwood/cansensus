import { DRINKS } from "@/lib/data";
import { caffeineDensity } from "@/lib/scoring";
import type { Ratings } from "@/lib/types";
import { SectionHeader } from "./SectionHeader";

/**
 * The form guide needs week-over-week crowd history: risers, fallers, and how
 * divisive a can is. All three came from invented numbers in the prototype
 * (a sine wobble and a hand-set standard deviation), so with real data they are
 * genuinely empty until the backend has been snapshotting for a few weeks.
 *
 * Rather than show three blank cards, this states what is missing and shows the
 * one intensity comparison the nutrition panel does support today.
 */
export function TrendsSection({ ratings }: { ratings: Ratings }) {
  const hasHistory = DRINKS.some((d) => d.crowd?.prevScore != null);
  const ratedCount = Object.keys(ratings).length;

  const strongest = [...DRINKS]
    .sort((a, b) => caffeineDensity(b) - caffeineDensity(a))
    .slice(0, 6);
  const gentlest = [...DRINKS]
    .sort((a, b) => caffeineDensity(a) - caffeineDensity(b))
    .slice(0, 6);

  return (
    <section id="trends" className="section">
      <div className="wrap">
        <SectionHeader num="03" title="Form guide" />
        <p className="lede">
          {hasHistory
            ? "Week-over-week movement across the league."
            : "Risers, fallers and the most divisive cans need week-over-week crowd history. Nothing has been snapshotted yet, so here is what the nutrition panel can tell you instead."}
        </p>

        <div className="grid300">
          <IntensityCard
            title="⚡ Strongest per ml"
            titleColor="var(--lime)"
            drinks={strongest}
          />
          <IntensityCard
            title="○ Gentlest per ml"
            titleColor="var(--cyan)"
            drinks={gentlest}
          />

          <div className="divisiveCard">
            <div
              className="label"
              style={{ color: "var(--gold)", marginBottom: 16 }}
            >
              Coming with the crowd
            </div>
            <ul className="pendingList">
              <li>
                <strong>Climbing / sliding</strong> — needs a weekly snapshot of
                every can&apos;s score. Starts the first Monday after launch.
              </li>
              <li>
                <strong>Most divisive</strong> — needs the spread of ratings on
                each can, which takes more than one rater.
              </li>
              <li>
                <strong>Your form</strong> — how your scores drift against the
                crowd over time.
              </li>
            </ul>
            <p
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--gold)",
                marginTop: 14,
                lineHeight: 1.5,
              }}
            >
              {ratedCount
                ? `${ratedCount} rating${ratedCount === 1 ? "" : "s"} logged on this device. They become week 1 of your form once sign-in lands.`
                : "Rate a can to start your own history."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function IntensityCard({
  title,
  titleColor,
  drinks,
}: {
  title: string;
  titleColor: string;
  drinks: typeof DRINKS;
}) {
  const max = Math.max(...drinks.map(caffeineDensity), 1);
  return (
    <div className="card">
      <div className="label" style={{ color: titleColor, marginBottom: 16 }}>
        {title}
      </div>
      {drinks.map((d) => {
        const density = caffeineDensity(d);
        return (
          <div key={d.id} className="trendRow">
            <span
              className="trendSwatch"
              style={{ background: d.color }}
              aria-hidden="true"
            />
            <span className="trendName">{d.name}</span>
            <span
              style={{
                width: 70,
                height: 6,
                borderRadius: 99,
                background: "var(--line)",
                overflow: "hidden",
                flex: "none",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  background: d.color,
                  width: `${Math.round((density / max) * 100)}%`,
                }}
              />
            </span>
            <span className="trendChange" style={{ color: "var(--muted)" }}>
              {density.toFixed(0)}
            </span>
          </div>
        );
      })}
      <div
        className="mono"
        style={{ fontSize: 10, color: "var(--faint)", marginTop: 10 }}
      >
        mg caffeine per 100 ml
      </div>
    </div>
  );
}
