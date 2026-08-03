/**
 * The moving liquid behind the hero headline.
 *
 * Approach: heavily blurred colour blobs, animated **only** on `transform`, so
 * every frame stays on the compositor thread and never touches layout. The
 * gooier alternative — SVG feTurbulence with feColorMatrix alpha thresholding —
 * gives a truer merging-liquid look but re-runs a filter over the full hero area
 * each frame, which is exactly the thing that stresses mobile GPUs.
 *
 * Every layer runs on the same 10s period with negative delays for variety, so
 * the whole thing is a genuinely seamless 10-second loop rather than something
 * that visibly jumps at the end.
 *
 * Readability comes first: the headline sits at 132px and must stay crisp, so
 * the blobs are low-opacity, `screen`-blended over near-black, and covered by a
 * scrim that darkens the top-left where the text actually is.
 */
export function HeroFlow() {
  return (
    <div className="heroFlow" aria-hidden="true">
      <span className="heroBlob heroBlob1" />
      <span className="heroBlob heroBlob2" />
      <span className="heroBlob heroBlob3" />
      <span className="heroBlob heroBlob4" />

      {/* Liquid surface line — the one literally "flowing" element, kept to a
          thin band at the bottom so it reads as a meniscus, not a wave graphic. */}
      <svg
        className="heroSurface"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id="flowStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D8FF3E" stopOpacity="0" />
            <stop offset="45%" stopColor="#D8FF3E" stopOpacity=".75" />
            <stop offset="70%" stopColor="#FF5B24" stopOpacity=".55" />
            <stop offset="100%" stopColor="#FF5B24" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Two copies offset by exactly one wavelength, drifting one wavelength
            over the 10s cycle — that is what makes the loop seamless. */}
        <g className="heroSurfaceTrack">
          <path
            d="M0,60 C120,20 240,100 360,60 C480,20 600,100 720,60 C840,20 960,100 1080,60 C1200,20 1320,100 1440,60 C1560,20 1680,100 1800,60 C1920,20 2040,100 2160,60 C2280,20 2400,100 2520,60 C2640,20 2760,100 2880,60"
            fill="none"
            stroke="url(#flowStroke)"
            strokeWidth="2.5"
          />
        </g>
      </svg>

      <span className="heroScrim" />
    </div>
  );
}
