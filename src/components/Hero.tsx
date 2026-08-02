import { SEASON, WEEK } from "@/lib/data";

type Props = {
  totalVotes: number;
  drinkCount: number;
  myCount: number;
};

export function Hero({ totalVotes, drinkCount, myCount }: Props) {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="heroKicker">
          <span className="heroKickerDot" aria-hidden="true" />
          <span>
            Season {SEASON} · Week {WEEK} · live standings
          </span>
        </div>

        <h1 className="heroTitle">
          The definitive
          <br />
          energy drink
          <br />
          <span style={{ color: "var(--lime)" }}>league table</span>
        </h1>

        <div className="heroBottom">
          <p className="heroCopy">
            Everyone drinks them. Nobody agrees. Rate the cans you have actually
            tasted, and the crowd sorts out the truth — scored on taste, kick,
            aftertaste and value, then cross-referenced against what is
            genuinely in the can.
          </p>

          <div className="heroStats">
            <Stat
              value={totalVotes.toLocaleString()}
              label="Ratings cast"
              color="var(--lime)"
            />
            <Stat value={drinkCount} label="Cans in play" />
            <Stat value={myCount} label="Rated by you" color="var(--orange)" />
          </div>
        </div>
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
