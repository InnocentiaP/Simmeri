import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { readinessDisplay, readinessTone } from "@/lib/readiness";
import { recommend } from "@/lib/recommendations/score";
import { useRecommendationData } from "@/lib/recommendations/use-recommendation-data";
import { RecipeCoverImage } from "@/components/app/RecipeCoverImage";

const PICKS = 3;

// Dashboard teaser for Tonight's Deck: the top few recommendations, each
// with the reason it was picked. Same ranking as the deck itself.
export function TonightPicks() {
  const { data, isLoading, error } = useRecommendationData();

  const picks = useMemo(
    () => (data ? recommend(data.inputs, { mood: "any", now: new Date() }).slice(0, PICKS) : []),
    [data],
  );

  // The dashboard already handles "no recipes" and load errors on its own.
  if (isLoading || error || !data || data.inputs.length === 0) return null;

  return (
    <section className="mt-10" aria-labelledby="tonight-picks-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="tonight-picks-heading"
          className="font-display text-xl font-semibold text-olive-deep"
        >
          Tonight's picks
        </h2>
        <Link to="/app/tonight" className="text-sm text-cocoa hover:underline">
          Open Tonight's Deck
        </Link>
      </div>

      {picks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-cream/40 p-4 text-center text-sm text-cocoa/70">
          Nothing is ready to cook right now.{" "}
          <Link to="/app/kitchen" className="text-olive-deep underline">
            Update your Kitchen
          </Link>{" "}
          or{" "}
          <Link to="/app/tonight" className="text-olive-deep underline">
            open the deck
          </Link>{" "}
          to include recipes that need a quick shop.
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-3">
            {picks.map((pick) => {
              const recipe = data.recipesById.get(pick.recipeId);
              const readiness = data.readinessById.get(pick.recipeId);
              if (!recipe || !readiness) return null;
              return (
                <li key={pick.recipeId}>
                  <Link
                    to="/app/recipes/$recipeId"
                    params={{ recipeId: recipe.id }}
                    className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-background transition hover:shadow-[var(--shadow-soft)]"
                  >
                    <RecipeCoverImage
                      bucket={recipe.cover_storage_bucket}
                      path={recipe.cover_storage_path}
                      alt={`${recipe.title} cover photo`}
                      className="aspect-[16/9] w-full"
                    />
                    <div className="flex flex-1 flex-col p-3">
                      <span
                        className={`self-start rounded-full border px-2 py-0.5 text-[11px] ${readinessTone(readiness.label)}`}
                      >
                        {readinessDisplay(readiness.label)}
                      </span>
                      <h3 className="mt-2 font-display text-base font-semibold leading-tight text-cocoa">
                        {recipe.title}
                      </h3>
                      <p className="mt-1 text-xs text-cocoa/70">{pick.reasons[0]}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link
            to="/app/tonight"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
          >
            <Sparkles className="h-4 w-4" /> Help me decide
          </Link>
        </>
      )}
    </section>
  );
}
