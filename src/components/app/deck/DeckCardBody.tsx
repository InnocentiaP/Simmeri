import { Clock, Heart, History } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Recipe } from "@/lib/api";
import { readinessDisplay, readinessTone, type ReadinessResult } from "@/lib/readiness";
import { cookingRatingEmoji, cookingRatingLabel } from "@/lib/cooking-rating";
import type { CookingSummary } from "@/lib/recommendations/score";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";

interface DeckCardBodyProps {
  recipe: Recipe;
  readiness: ReadinessResult;
  cooking: CookingSummary | undefined;
  reasons: string[];
  compact?: boolean;
}

// Visual content of one Tonight's Deck card: cover, readiness, time, and the
// plain-language reasons it was picked. Purely presentational — actions and
// swipe handling live in the deck route.
export function DeckCardBody({
  recipe,
  readiness,
  cooking,
  reasons,
  compact = false,
}: DeckCardBodyProps) {
  const minutes =
    recipe.prep_time_minutes == null && recipe.cook_time_minutes == null
      ? null
      : (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);
  const [headline, ...rest] = reasons;

  return (
    <>
      <div className="relative">
        <RecipeCoverImage
          bucket={recipe.cover_storage_bucket}
          path={recipe.cover_storage_path}
          alt={`${recipe.title} cover photo`}
          className={`w-full ${compact ? "aspect-[16/9]" : "aspect-[4/3]"}`}
        />
        {/* Solid backing so the translucent readiness tone stays legible over any photo. */}
        <span className="absolute left-3 top-3 rounded-full bg-background">
          <span
            className={`block rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${readinessTone(readiness.label)}`}
          >
            {readinessDisplay(readiness.label)}
          </span>
        </span>
        {minutes != null && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-cocoa">
            <Clock className="h-3 w-3" aria-hidden="true" /> {minutes} min
          </span>
        )}
      </div>

      <div className={compact ? "p-4" : "p-5"}>
        <h3
          className={`flex items-start gap-1.5 font-display leading-tight text-coffee ${compact ? "text-lg" : "text-2xl"}`}
        >
          <span className="flex-1">{recipe.title}</span>
          {recipe.favorited_at && (
            <Heart
              className="mt-1 h-4 w-4 shrink-0 fill-terracotta text-terracotta"
              aria-label="Favorite"
            />
          )}
        </h3>

        {headline && <p className="mt-1.5 text-sm text-cocoa/85">{headline}</p>}

        {!compact && rest.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-cocoa/65">
            {rest.slice(0, 3).map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}

        {cooking?.lastCookedAt && (
          <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-olive-deep">
            <History className="h-3 w-3" aria-hidden="true" />
            Cooked {cooking.timesCooked === 1 ? "once" : `${cooking.timesCooked} times`}, last{" "}
            {formatDistanceToNow(new Date(cooking.lastCookedAt), { addSuffix: true })}
            {cooking.lastRating && (
              <span className="text-cocoa/70">
                · <span aria-hidden="true">{cookingRatingEmoji(cooking.lastRating)}</span>{" "}
                {cookingRatingLabel(cooking.lastRating)}
              </span>
            )}
          </p>
        )}
      </div>
    </>
  );
}
