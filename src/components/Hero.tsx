import { SEASON, WEEK } from "@/lib/data";
import { HeroFlow } from "./HeroFlow";

type Props = {
  drinkCount: number;
  brandCount: number;
  myCount: number;
};

export function Hero({ drinkCount, brandCount, myCount }: Props) {
  return (
    <section className="hero">
      <HeroFlow />
      <div className="wrap">
        <div className="heroKicker">
          <span className="heroKickerDot" aria-hidden="true" />
          <span>
            Season {SEASON} · Week {WEEK} · {drinkCount} cans, sourced
          </span>
        </div>

        {/* Two lines, not three: "The crowd-sourced" measured 11.77em wide
            against the old "The definitive" at 7.96em, so a three-line version
            wrapped mid-phrase at every width below 1440px. Two lines let the
            type get bigger AND hold their shape from 390px up. */}
        <h1 className="heroTitle">
          Energy drink
          <br />
          <span style={{ color: "var(--lime)" }}>cansensus</span>
        </h1>

        <div className="heroBottom">
          <p className="heroCopy">
            Everyone drinks them. Nobody agrees. Rate the cans you have actually
            tasted and the crowd works out the truth — scored on taste, kick,
            aftertaste and value, then checked against the real nutrition panel.
            Missing a can? Add it.
          </p>

          <div className="heroStats">
            <Stat
              value={drinkCount}
              label="Cans in play"
              color="var(--lime)"
            />
            <Stat value={brandCount} label="Brands" />
            <Stat value={myCount} label="Rated by you" color="var(--orange)" />
          </div>
        </div>

        <a href="#rate" className="scrollCue">
          <span>Scroll — six sections</span>
          <svg
            className="scrollCueArrow"
            width="10"
            height="14"
            viewBox="0 0 10 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M5 0v12M1 8l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
        </a>
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <div className="statBox">
      <div className="statValue" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="statLabel">{label}</div>
    </div>
  );
}
