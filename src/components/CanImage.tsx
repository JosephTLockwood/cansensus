import Image from "next/image";
import type { Drink } from "@/lib/types";

/**
 * The can visual.
 *
 * This deliberately does NOT show the Open Food Facts photograph. Those are
 * contributor snapshots — frequently a hand holding a can on a kitchen table,
 * lit badly, at an angle — and they made the page look worse than the design's
 * own stylised can, which is on-brand and consistent across all 38 rows.
 *
 * Official brand photography is not an option: it is the brands' copyright with
 * no licence granted, unlike the CC BY-SA images from Open Food Facts. Real
 * photos come back when submissions let people upload their own, which we can
 * license properly through submission terms.
 *
 * A user-uploaded `photoUrl` IS rendered, though: it was taken deliberately, of
 * that can, for this purpose. That is the whole reason submissions accept one.
 */
export function CanImage({
  drink,
  variant,
}: {
  drink: Drink;
  variant: "panel" | "row";
}) {
  if (variant === "panel" && drink.photoUrl) {
    return (
      <div className="canPhoto">
        <Image
          src={drink.photoUrl}
          alt={`${drink.name} can`}
          width={240}
          height={420}
          className="canPhotoImg"
          unoptimized
        />
      </div>
    );
  }

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
