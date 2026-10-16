import { useCallback, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "motion/react";
import { toast } from "sonner";
import {
  BookOpen,
  CalendarPlus,
  Flame,
  Heart,
  RotateCcw,
  Shuffle,
  Sparkles,
  Undo2,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { createMealPlanEntry, type Recipe } from "@/lib/api";
import { formatDateKey } from "@/lib/date-range";
import {
  MOODS,
  recommend,
  scoreRecipe,
  type Mood,
  type RecommendationInput,
} from "@/lib/recommendations/score";
import {
  RECOMMENDATION_QUERY_KEY,
  useRecommendationData,
} from "@/lib/recommendations/use-recommendation-data";
import {
  deckReducer,
  countDecisions,
  EMPTY_DECK,
  parseStoredDeck,
  remainingCards,
  shortlistIds,
  type DeckDecision,
  type DeckState,
} from "@/lib/recommendations/deck-state";
import { DeckCardBody } from "@/components/app/deck/DeckCardBody";
import { MealPlanEntryForm } from "@/components/app/MealPlanEntryForm";

export const Route = createFileRoute("/_authenticated/app/tonight")({
  head: () => ({ meta: [{ title: "Tonight's Deck — Simmeri" }] }),
  component: TonightPage,
});

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 500;

// One deck per calendar day; a skip is "not now", never "never".
function storageKey(): string {
  return `simmeri:tonight-deck:${formatDateKey(new Date())}`;
}

function loadDeck(): DeckState {
  try {
    return parseStoredDeck(window.sessionStorage.getItem(storageKey()));
  } catch {
    return EMPTY_DECK;
  }
}

// How many times the user pressed Shuffle today (part of the shuffle seed).
function shuffleKey(): string {
  return `simmeri:tonight-shuffle:${formatDateKey(new Date())}`;
}

function loadShuffleCount(): number {
  try {
    const n = Number(window.sessionStorage.getItem(shuffleKey()));
    return Number.isInteger(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function TonightPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion() ?? false;
  const { data, isLoading, error, dataUpdatedAt } = useRecommendationData();

  const [mood, setMood] = useState<Mood>("any");
  const [deck, dispatch] = useReducer(deckReducer, undefined, loadDeck);
  const [exitDirection, setExitDirection] = useState<1 | -1>(1);
  const [announcement, setAnnouncement] = useState("");
  const [planRecipe, setPlanRecipe] = useState<Recipe | null>(null);
  const [cookingId, setCookingId] = useState<string | null>(null);
  const [shuffleCount, setShuffleCount] = useState(loadShuffleCount);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(shuffleKey(), String(shuffleCount));
    } catch {
      // Not critical: the shuffle just resets to today's default order.
    }
  }, [shuffleCount]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey(), JSON.stringify(deck));
    } catch {
      // Storage unavailable (private mode etc.) — the deck still works in memory.
    }
  }, [deck]);

  // `now` is fixed per data load so scores don't drift between renders.
  const now = useMemo(() => new Date(dataUpdatedAt || Date.now()), [dataUpdatedAt]);

  const inputById = useMemo(
    () => new Map<string, RecommendationInput>((data?.inputs ?? []).map((i) => [i.recipeId, i])),
    [data],
  );

  // Endless within the user's own collection: every recipe is in the deck,
  // ranked so what's cookable now comes first, then recipes that need a
  // shop (fine when planning a later day), then ones missing a core item.
  // Within each group the order is shuffled per day (and per Shuffle press),
  // so the same recipes don't always lead and others aren't always last.
  const seed = `${formatDateKey(now)}:${shuffleCount}`;
  const ranked = useMemo(
    () =>
      data
        ? recommend(data.inputs, {
            mood,
            now,
            includeNeedsShopping: true,
            includeNotReady: true,
            seed,
          })
        : [],
    [data, mood, now, seed],
  );
  const rankedIds = useMemo(() => ranked.map((r) => r.recipeId), [ranked]);
  const reasonsById = useMemo(() => new Map(ranked.map((r) => [r.recipeId, r.reasons])), [ranked]);

  const remaining = remainingCards(rankedIds, deck);
  const currentId = remaining[0] ?? null;
  const skippedCount = countDecisions(deck, "skip");
  const shortlist = shortlistIds(deck).filter((id) => data?.recipesById.has(id));

  const reasonsFor = useCallback(
    (recipeId: string): string[] => {
      const fromRanking = reasonsById.get(recipeId);
      if (fromRanking) return fromRanking;
      const input = inputById.get(recipeId);
      return input ? scoreRecipe(input, mood, now).reasons : [];
    },
    [reasonsById, inputById, mood, now],
  );

  const decide = useCallback(
    (decision: DeckDecision) => {
      if (!currentId) return;
      const title = data?.recipesById.get(currentId)?.title ?? "Recipe";
      setExitDirection(decision === "shortlist" ? 1 : -1);
      dispatch({ type: "decide", recipeId: currentId, decision });
      setAnnouncement(
        decision === "shortlist" ? `${title} added to your shortlist.` : `${title} skipped.`,
      );
    },
    [currentId, data],
  );

  const undo = useCallback(() => {
    const last = deck.history[deck.history.length - 1];
    if (!last) return;
    dispatch({ type: "undo" });
    const title = data?.recipesById.get(last.recipeId)?.title ?? "Recipe";
    setAnnouncement(`Brought back ${title}.`);
  }, [deck.history, data]);

  // Keyboard alternative to swiping: ← skip, → shortlist, Z undo.
  // Ignored while typing in a field or when a dialog is open.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented || e.altKey || e.metaKey || planRecipe) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"))
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        decide("skip");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        decide("shortlist");
      } else if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [decide, undo, planRecipe]);

  function invalidatePlans() {
    qc.invalidateQueries({ queryKey: RECOMMENDATION_QUERY_KEY });
    qc.invalidateQueries({ queryKey: ["meal-plan-entries"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  // "Cook this" = make it tonight's dinner (an explicit, reversible plan
  // entry — not a cooking-history record, since nothing is cooked yet), then
  // open the recipe to start cooking.
  async function cookThis(recipeId: string) {
    const recipe = data?.recipesById.get(recipeId);
    if (!user || !recipe || cookingId) return;
    setCookingId(recipeId);
    try {
      if (data?.plannedTodayIds.has(recipeId)) {
        toast.success(`${recipe.title} is already on today's plan. Enjoy!`);
      } else {
        await createMealPlanEntry({
          userId: user.id,
          recipeId,
          plannedDate: formatDateKey(new Date()),
          mealType: "dinner",
          servings: recipe.servings,
          notes: null,
        });
        toast.success(`${recipe.title} is tonight's dinner.`);
      }
      invalidatePlans();
      navigate({ to: "/app/recipes/$recipeId", params: { recipeId } });
    } catch (e) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as { message: unknown }).message)
          : null;
      toast.error(message || "Couldn't add this to tonight's plan.");
    } finally {
      setCookingId(null);
    }
  }

  function startOver() {
    dispatch({ type: "reset" });
    setAnnouncement("Deck restarted.");
  }

  // Reorders the cards you haven't decided on yet; skips, shortlist, and
  // planned picks are kept.
  function shuffleDeck() {
    setShuffleCount((n) => n + 1);
    setAnnouncement("Deck shuffled.");
  }

  function revisitSkipped() {
    dispatch({ type: "clearSkips" });
    setAnnouncement("Skipped recipes are back in the deck.");
  }

  if (isLoading) return <div className="text-cocoa/70">Shuffling tonight's ideas…</div>;
  if (error || !data)
    return (
      <div className="rounded-xl border border-terracotta/40 bg-terracotta/5 p-4 text-terracotta">
        Couldn't load your recipes. Refresh to try again.
      </div>
    );

  const currentRecipe = currentId ? data.recipesById.get(currentId) : undefined;
  const currentReadiness = currentId ? data.readinessById.get(currentId) : undefined;
  const nextRecipeExists = remaining.length > 1;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <p className="font-hand text-xl text-olive-deep">Tonight</p>
        <h1 className="font-display text-3xl font-semibold text-olive-deep">Tonight's Deck</h1>
        <p className="mt-1 text-sm text-cocoa/70">
          Swipe through your own recipes — the ones you can cook right now come first. Shortlist
          what looks good, cook one tonight, or plan it for another day.
        </p>
      </header>

      <div
        role="radiogroup"
        aria-label="What are you in the mood for?"
        className="mb-6 flex flex-wrap gap-2"
      >
        {MOODS.map((m) => {
          const active = mood === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMood(m.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-olive-deep bg-olive-deep text-primary-foreground"
                  : "border-border bg-background text-cocoa hover:bg-cream-deep/40"
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {data.inputs.length === 0 ? (
        <EmptyPanel title="No recipes yet">
          Tonight's Deck picks from recipes you've saved.{" "}
          <Link to="/app/recipes/new" className="text-olive-deep underline">
            Add your first recipe
          </Link>{" "}
          or{" "}
          <Link to="/app/recipes/import" className="text-olive-deep underline">
            import one
          </Link>
          .
        </EmptyPanel>
      ) : ranked.length === 0 ? (
        <EmptyPanel
          title={`Nothing matches “${MOODS.find((m) => m.value === mood)?.label}” right now`}
        >
          <button
            type="button"
            onClick={() => setMood("any")}
            className="text-olive-deep underline"
          >
            Show ideas for any mood
          </button>
        </EmptyPanel>
      ) : currentRecipe && currentReadiness && currentId ? (
        <section aria-label="Recipe deck" className="mx-auto w-full max-w-md">
          <div className="mb-2 flex items-center justify-between text-xs text-cocoa/60">
            <span>
              {remaining.length} {remaining.length === 1 ? "idea" : "ideas"} left
            </span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={shuffleDeck}
                disabled={remaining.length < 2}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-cream-deep/40 disabled:opacity-40"
              >
                <Shuffle className="h-3.5 w-3.5" /> Shuffle
              </button>
              <button
                type="button"
                onClick={undo}
                disabled={deck.history.length === 0}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-cream-deep/40 disabled:opacity-40"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
            </span>
          </div>

          <div className="relative">
            {nextRecipeExists && (
              <div
                aria-hidden="true"
                className="absolute inset-x-4 -bottom-2 top-3 rounded-[28px] border border-border/60 bg-cream shadow-[var(--shadow-cozy)]"
              />
            )}
            <AnimatePresence mode="popLayout" initial={false} custom={exitDirection}>
              <SwipeCard
                key={currentId}
                title={currentRecipe.title}
                reduceMotion={reduceMotion}
                onSwipe={decide}
              >
                <DeckCardBody
                  recipe={currentRecipe}
                  readiness={currentReadiness}
                  cooking={data.cookingById.get(currentId)}
                  reasons={reasonsFor(currentId)}
                />
              </SwipeCard>
            </AnimatePresence>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => decide("skip")}
              className="flex items-center justify-center gap-1.5 rounded-full border border-border/70 bg-cream/60 px-3 py-2.5 text-sm font-medium text-cocoa hover:bg-cream-deep/50"
            >
              <X className="h-4 w-4" /> Skip
            </button>
            <button
              type="button"
              onClick={() => decide("shortlist")}
              className="flex items-center justify-center gap-1.5 rounded-full border border-terracotta/40 bg-terracotta/10 px-3 py-2.5 text-sm font-medium text-terracotta hover:bg-terracotta/15"
            >
              <Heart className="h-4 w-4" /> Shortlist
            </button>
            <Link
              to="/app/recipes/$recipeId"
              params={{ recipeId: currentId }}
              className="flex items-center justify-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
            >
              <BookOpen className="h-4 w-4" /> View
            </Link>
            <button
              type="button"
              onClick={() => setPlanRecipe(currentRecipe)}
              className="flex items-center justify-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
            >
              <CalendarPlus className="h-4 w-4" /> Plan a day
            </button>
            <button
              type="button"
              disabled={cookingId !== null}
              onClick={() => cookThis(currentId)}
              className="col-span-2 flex items-center justify-center gap-1.5 rounded-full bg-olive-deep px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-olive disabled:opacity-60"
            >
              <Flame className="h-4 w-4" />{" "}
              {cookingId === currentId ? "Adding…" : "Cook this tonight"}
            </button>
          </div>

          <p className="mt-3 text-center text-xs text-cocoa/55">
            <span className="md:hidden">Swipe left to skip, right to shortlist.</span>
            <span className="hidden md:inline">
              Keyboard: ← skip · → shortlist · Z undo. You can also drag the card.
            </span>
          </p>
        </section>
      ) : (
        <EmptyPanel
          title="You've seen all your recipes"
          icon={<Sparkles className="mb-2 h-6 w-6 text-olive-deep" />}
        >
          {shortlist.length > 0
            ? "Pick one from your shortlist below, or go around again."
            : "Nothing caught your eye? Go around again, or add a few new recipes."}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {skippedCount > 0 && (
              <button
                type="button"
                onClick={revisitSkipped}
                className="rounded-full bg-olive-deep px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-olive"
              >
                Go through skipped ones again ({skippedCount})
              </button>
            )}
            <Link
              to="/app/recipes/import"
              className="rounded-full border border-border bg-background px-4 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
            >
              Import a recipe
            </Link>
            {deck.history.length > 0 && (
              <button
                type="button"
                onClick={undo}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo last
              </button>
            )}
            <button
              type="button"
              onClick={startOver}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-sm text-cocoa hover:bg-cream-deep/40"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Start over
            </button>
          </div>
        </EmptyPanel>
      )}

      {shortlist.length > 0 && (
        <section aria-labelledby="shortlist-heading" className="mt-10">
          <h2 id="shortlist-heading" className="font-display text-xl font-semibold text-olive-deep">
            Your shortlist
          </h2>
          <p className="mb-3 text-sm text-cocoa/70">
            Compare, then cook one tonight or plan it for another day.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {shortlist.map((id) => {
              const recipe = data.recipesById.get(id);
              const readiness = data.readinessById.get(id);
              if (!recipe || !readiness) return null;
              return (
                <li
                  key={id}
                  className="flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-background"
                >
                  <DeckCardBody
                    compact
                    recipe={recipe}
                    readiness={readiness}
                    cooking={data.cookingById.get(id)}
                    reasons={reasonsFor(id)}
                  />
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-border/50 p-3">
                    <button
                      type="button"
                      disabled={cookingId !== null}
                      onClick={() => cookThis(id)}
                      className="inline-flex items-center gap-1 rounded-full bg-olive-deep px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-olive disabled:opacity-60"
                    >
                      <Flame className="h-3.5 w-3.5" /> {cookingId === id ? "Adding…" : "Cook this"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanRecipe(recipe)}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-cocoa hover:bg-cream-deep/40"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" /> Plan
                    </button>
                    <Link
                      to="/app/recipes/$recipeId"
                      params={{ recipeId: id }}
                      className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs text-cocoa hover:bg-cream-deep/40"
                    >
                      <BookOpen className="h-3.5 w-3.5" /> View
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        dispatch({ type: "unshortlist", recipeId: id });
                        setAnnouncement(`${recipe.title} removed from your shortlist.`);
                      }}
                      className="ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-xs text-cocoa/60 hover:text-cocoa"
                      aria-label={`Remove ${recipe.title} from shortlist`}
                    >
                      <X className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {planRecipe && (
        <MealPlanEntryForm
          mode="create"
          recipe={planRecipe}
          defaultDate={formatDateKey(new Date())}
          defaultMealType="dinner"
          onDone={() => {
            // Planned recipes leave the deck and shortlist so you can keep
            // swiping for the next day.
            setExitDirection(1);
            dispatch({ type: "decide", recipeId: planRecipe.id, decision: "planned" });
            setAnnouncement(`${planRecipe.title} added to your meal plan.`);
            setPlanRecipe(null);
            invalidatePlans();
          }}
          onClose={() => setPlanRecipe(null)}
        />
      )}
    </div>
  );
}

interface SwipeCardProps {
  title: string;
  reduceMotion: boolean;
  onSwipe: (decision: DeckDecision) => void;
  children: ReactNode;
}

// The draggable top card. Swiping is an optional shortcut — every action is
// also a visible button and a keyboard key — and drag still works with
// reduced motion, just without tilt or fly-out animation.
function SwipeCard({ title, reduceMotion, onSwipe, children }: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-10, 10]);
  const skipHint = useTransform(x, [-SWIPE_DISTANCE, -24], [1, 0]);
  const shortlistHint = useTransform(x, [24, SWIPE_DISTANCE], [0, 1]);

  const transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 30 };
  const variants = {
    enter: { opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 10 },
    center: { opacity: 1, scale: 1, y: 0, transition },
    exit: (direction: 1 | -1) =>
      reduceMotion
        ? { opacity: 0, transition: { duration: 0 } }
        : {
            x: direction * 520,
            rotate: direction * 14,
            opacity: 0,
            transition: { duration: 0.28 },
          },
  };

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) onSwipe("shortlist");
    else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) onSwipe("skip");
  }

  return (
    <motion.article
      aria-label={title}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      drag="x"
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={handleDragEnd}
      style={{ x, rotate: reduceMotion ? 0 : rotate }}
      className="relative z-10 cursor-grab touch-pan-y select-none overflow-hidden rounded-[28px] bg-background text-coffee shadow-[var(--shadow-cozy)] active:cursor-grabbing"
    >
      <motion.span
        aria-hidden="true"
        style={{ opacity: skipHint }}
        className="pointer-events-none absolute right-4 top-16 z-20 -rotate-6 rounded-xl border-2 border-cocoa bg-background/90 px-3 py-1 font-display text-lg font-semibold text-cocoa"
      >
        Skip
      </motion.span>
      <motion.span
        aria-hidden="true"
        style={{ opacity: shortlistHint }}
        className="pointer-events-none absolute left-4 top-16 z-20 rotate-6 rounded-xl border-2 border-terracotta bg-background/90 px-3 py-1 font-display text-lg font-semibold text-terracotta"
      >
        Shortlist ♥
      </motion.span>
      {children}
    </motion.article>
  );
}

function EmptyPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-cream/40 p-8 text-center">
      {icon}
      <h2 className="font-display text-lg font-semibold text-cocoa">{title}</h2>
      <div className="mt-1 max-w-md text-sm text-cocoa/70">{children}</div>
    </div>
  );
}
