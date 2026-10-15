import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { History } from "lucide-react";
import { listCookingHistory, listCookingPhotosForHistoryIds } from "@/lib/api";
import { cookingRatingEmoji, cookingRatingLabel, isCookingRating } from "@/lib/cooking-rating";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";

const MAX_PHOTOS = 3;

interface LastCookedSummaryProps {
  recipeId: string;
}

// "Last time you made this" — the most recent cooking entry's rating, note,
// and photos, shown near the top of Recipe Detail so a re-cook starts from
// the user's own memory. Shares the ["cooking-history", recipeId] cache with
// CookingHistoryList, so it updates whenever that list does. Renders nothing
// for a recipe that has never been cooked.
export function LastCookedSummary({ recipeId }: LastCookedSummaryProps) {
  const historyQuery = useQuery({
    queryKey: ["cooking-history", recipeId],
    queryFn: () => listCookingHistory(recipeId),
  });

  const history = historyQuery.data ?? [];
  const latest = history[0];

  const photosQuery = useQuery({
    queryKey: ["cooking-photos", recipeId, latest ? [latest.id] : []],
    queryFn: () => listCookingPhotosForHistoryIds(latest ? [latest.id] : []),
    enabled: !!latest,
  });

  if (!latest) return null;

  const photos = (photosQuery.data ?? []).slice(0, MAX_PHOTOS);
  const cookedAt = new Date(latest.cooked_at);

  return (
    <section
      aria-labelledby="last-cooked-heading"
      className="mb-6 rounded-3xl border border-border/70 bg-cream/40 p-5"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="last-cooked-heading"
          className="inline-flex items-center gap-2 font-display text-lg font-semibold text-olive-deep"
        >
          <History className="h-4 w-4" /> Last time you made this
        </h2>
        <a
          href="#cooking-history"
          className="text-xs text-cocoa/70 underline underline-offset-2 hover:text-cocoa"
        >
          {history.length === 1 ? "Cooked once" : `Cooked ${history.length} times`}
        </a>
      </div>

      <p className="flex flex-wrap items-center gap-2 text-sm text-cocoa">
        <time dateTime={latest.cooked_at} title={cookedAt.toLocaleString()}>
          {formatDistanceToNow(cookedAt, { addSuffix: true })}
        </time>
        {isCookingRating(latest.rating) && (
          <span className="inline-flex items-center gap-1 rounded-full border border-caramel/40 bg-caramel/10 px-2 py-0.5 text-xs">
            <span aria-hidden="true">{cookingRatingEmoji(latest.rating)}</span>
            {cookingRatingLabel(latest.rating)}
          </span>
        )}
      </p>

      {latest.notes && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm italic text-cocoa/80">
          “{latest.notes}”
        </p>
      )}

      {photos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="h-24 w-24 overflow-hidden rounded-xl border border-border/70"
            >
              <RecipeCoverImage
                bucket={photo.storage_bucket}
                path={photo.storage_path}
                alt="Your photo from the last time you cooked this"
                className="h-24 w-24"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
