/**
 * Infinite scrolling standings strip. The text is rendered twice so the
 * -50% translate in `edl-marquee` loops seamlessly.
 */
export function Ticker({ text }: { text: string }) {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marqueeTrack">
        <div className="marqueeText">{text}</div>
        <div className="marqueeText">{text}</div>
      </div>
    </div>
  );
}
