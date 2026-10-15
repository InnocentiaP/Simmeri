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

export function MeriSpot({ pose, size = 96, alt, className }: Props) {
  return (
    <img
      src="/images/simmeri/meri-head.png"
      alt={alt ?? `Meri the kitchen duck${pose ? ` — ${pose}` : ""}`}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
    />
  );
}
