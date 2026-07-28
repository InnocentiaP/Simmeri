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
      src="/images/simmeri/simi-head.png"
      alt={alt ?? `Simi the kitchen duck${pose ? ` — ${pose}` : ""}`}
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      draggable={false}
    />
  );
}
