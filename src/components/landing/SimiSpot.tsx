import simiSheet from "@/assets/simi-sheet.png.asset.json";
import simiUsage from "@/assets/simi-usage.png.asset.json";

// Crops from the mascot character sheets. Values are % of natural image
// dimensions, tuned by eye against the uploaded reference sheets.
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

type CropSpec = { src: string; x: number; y: number; w: number; h: number };

// Grid math: sheet expressions row y ~ 50-64%, poses row y ~ 68-84%.
// Each cell ~ 14% wide.
const CROPS: Record<SimiPose, CropSpec> = {
  happy: { src: simiSheet.url, x: 4, y: 47, w: 13, h: 20 },
  thinking: { src: simiSheet.url, x: 17, y: 47, w: 13, h: 20 },
  curious: { src: simiSheet.url, x: 31, y: 47, w: 13, h: 20 },
  excited: { src: simiSheet.url, x: 45, y: 47, w: 13, h: 20 },
  proud: { src: simiSheet.url, x: 59, y: 47, w: 13, h: 20 },
  concerned: { src: simiSheet.url, x: 73, y: 47, w: 13, h: 20 },
  sleepy: { src: simiSheet.url, x: 86, y: 47, w: 14, h: 20 },
  gathering: { src: simiSheet.url, x: 4, y: 67, w: 13, h: 20 },
  checking: { src: simiSheet.url, x: 17, y: 67, w: 13, h: 20 },
  shopping: { src: simiSheet.url, x: 31, y: 67, w: 13, h: 20 },
  cooking: { src: simiSheet.url, x: 45, y: 67, w: 13, h: 20 },
  checklist: { src: simiSheet.url, x: 73, y: 67, w: 13, h: 20 },
  peeking: { src: simiSheet.url, x: 86, y: 67, w: 14, h: 20 },
  welcome: { src: simiUsage.url, x: 6, y: 42, w: 22, h: 30 },
  loading: { src: simiUsage.url, x: 28, y: 42, w: 22, h: 30 },
  tip: { src: simiUsage.url, x: 51, y: 42, w: 22, h: 30 },
  success: { src: simiUsage.url, x: 74, y: 42, w: 22, h: 30 },
  recommend: { src: simiUsage.url, x: 6, y: 68, w: 22, h: 30 },
  empty: { src: simiUsage.url, x: 28, y: 68, w: 22, h: 30 },
};

interface Props {
  pose: SimiPose;
  size?: number;
  alt?: string;
  className?: string;
}

export function SimiSpot({ pose, size = 96, alt, className }: Props) {
  const c = CROPS[pose];
  return (
    <div
      role="img"
      aria-label={alt ?? `Simi the duck — ${pose}`}
      className={className}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${c.src})`,
        backgroundSize: `${(100 / c.w) * 100}% ${(100 / c.h) * 100}%`,
        backgroundPosition: `${(c.x / (100 - c.w)) * 100}% ${(c.y / (100 - c.h)) * 100}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
