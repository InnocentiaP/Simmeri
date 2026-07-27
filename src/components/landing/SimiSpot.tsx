import simiHead from "@/assets/simi-head.png.asset.json";

// Legacy pose prop kept for API compatibility with existing call sites; a
// single clean head sticker replaces the old character-sheet crops.
export type SimiPose =
  | "happy"
  | "thinking"
  | "curious"
  | "excited"
  | "proud"
  | "concerned"
  | "sleepy"
  | "gathering"
  | "checking"
  | "shopping"
  | "cooking"
  | "checklist"
  | "peeking"
  | "welcome"
  | "loading"
  | "tip"
  | "success"
  | "recommend"
  | "empty";

interface Props {
  pose?: SimiPose;
  size?: number;
  alt?: string;
  className?: string;
}

export function SimiSpot({ pose, size = 96, alt, className }: Props) {
  return (
    <img
      src={simiHead.url}
      alt={alt ?? `Simi the kitchen duck${pose ? ` — ${pose}` : ""}`}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
    />
  );
}
