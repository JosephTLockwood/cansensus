import Image from "next/image";
import type { Drink } from "@/lib/types";

/**
 * A can's real photograph, falling back to the design's abstract gradient can
 * when Open Food Facts has no image for it. Nothing ever renders empty.
 *
 * OFF photos are shot on white, so on this dark palette they need their own
 * faintly-lit panel or they read as a floating white rectangle.
 */
export function CanImage({
  drink,
  variant,
}: {
  drink: Drink;
  variant: "panel" | "row";
}) {
  // Deliberately a colour chip, not a photo. Open Food Facts photos are
  // contributor snapshots — often a hand holding a can on a kitchen table —
  // and at 20px they read as noise. The photo earns its space in the rate
  // panel and the expanded row, where it is big enough to recognise.
  if (variant === "row") {
    return (
      <span
        className="rowSwatch"
        style={{
          background: `linear-gradient(160deg,${drink.color},rgba(0,0,0,.55))`,
        }}
        aria-hidden="true"
      />
    );
  }

  if (!drink.imageUrl) return <FallbackCan drink={drink} />;

  return (
    <div className="canPhoto">
      <Image
        src={drink.imageUrl}
        alt={`${drink.name} can`}
        width={220}
        height={400}
        className="canPhotoImg"
        unoptimized
        priority={false}
      />
    </div>
  );
}

/** The original design's stylised can — still the fallback, not dead code. */
function FallbackCan({ drink }: { drink: Drink }) {
  return (
    <div
      className="can"
      style={{
        background: `linear-gradient(155deg,${drink.color},#0A0B09 130%)`,
      }}
    >
      <span className="canSheen" />
      <span className="canRibTop" />
      <span className="canRibBottom" />
      <div className="canLabel">
        <span className="canLabelText">{drink.name}</span>
      </div>
    </div>
  );
}
