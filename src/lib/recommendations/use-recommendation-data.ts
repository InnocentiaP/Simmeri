import { useQuery } from "@tanstack/react-query";
import {
  listCookingHistorySummaryRows,
  listKitchenItems,
  listMealPlanEntriesInRange,
  listRecipeIngredientsForRecipeIds,
  listRecipes,
  type Recipe,
} from "@/lib/api";
import { computeReadiness, type Importance, type ReadinessResult } from "@/lib/readiness";
import { addDays, formatDateKey } from "@/lib/date-range";
import { summarizeCookingHistory, type CookingSummary, type RecommendationInput } from "./score";

export interface RecommendationData {
  inputs: RecommendationInput[];
  recipesById: Map<string, Recipe>;
  readinessById: Map<string, ReadinessResult>;
  cookingById: Map<string, CookingSummary>;
  // Recipes already planned (status "planned") for today, any meal slot.
  plannedTodayIds: Set<string>;
}

export const RECOMMENDATION_QUERY_KEY = ["recommendations"] as const;

// Loads everything recommendations need in parallel — active recipes, their
// ingredients, active Kitchen items, cooking history, and the coming week's
// planned meals — and turns it into RecommendationInput rows. Readiness is
// the same computeReadiness used everywhere else, so a recipe's label here
// always matches its label on Recipe Detail.
export function useRecommendationData() {
  return useQuery({
    queryKey: RECOMMENDATION_QUERY_KEY,
    queryFn: async (): Promise<RecommendationData> => {
      const today = new Date();
      const [recipes, kitchen, historyRows, planned] = await Promise.all([
        listRecipes(false),
        listKitchenItems(false),
        listCookingHistorySummaryRows(),
        listMealPlanEntriesInRange(formatDateKey(today), formatDateKey(addDays(today, 6))),
      ]);
      const ingredients = await listRecipeIngredientsForRecipeIds(recipes.map((r) => r.id));

      const ingredientsByRecipe = new Map<
        string,
        { display_name: string; importance: Importance }[]
      >();
      for (const ing of ingredients) {
        const list = ingredientsByRecipe.get(ing.recipe_id) ?? [];
        list.push({ display_name: ing.display_name, importance: ing.importance as Importance });
        ingredientsByRecipe.set(ing.recipe_id, list);
      }

      const cookingById = summarizeCookingHistory(historyRows);
      const stillPlanned = planned.filter((e) => e.status === "planned");
      const plannedSoon = new Set(stillPlanned.map((e) => e.recipe_id));
      const todayKey = formatDateKey(today);
      const plannedTodayIds = new Set(
        stillPlanned.filter((e) => e.planned_date === todayKey).map((e) => e.recipe_id),
      );

      const recipesById = new Map<string, Recipe>();
      const readinessById = new Map<string, ReadinessResult>();
      const inputs: RecommendationInput[] = [];

      for (const recipe of recipes) {
        const readiness = computeReadiness(ingredientsByRecipe.get(recipe.id) ?? [], kitchen);
        const cooking = cookingById.get(recipe.id);
        const exp = readiness.explanation;
        const minutes =
          recipe.prep_time_minutes == null && recipe.cook_time_minutes == null
            ? null
            : (recipe.prep_time_minutes ?? 0) + (recipe.cook_time_minutes ?? 0);

        recipesById.set(recipe.id, recipe);
        readinessById.set(recipe.id, readiness);
        inputs.push({
          recipeId: recipe.id,
          readiness: readiness.label,
          runningLow: exp.running_low,
          needsCheck: exp.needs_check,
          missing: [...exp.missing_core, ...exp.missing_supporting, ...exp.missing_seasoning],
          totalMinutes: minutes,
          favorite: recipe.favorited_at != null,
          timesCooked: cooking?.timesCooked ?? 0,
          lastCookedAt: cooking?.lastCookedAt ?? null,
          lastRating: cooking?.lastRating ?? null,
          plannedSoon: plannedSoon.has(recipe.id),
        });
      }

      return { inputs, recipesById, readinessById, cookingById, plannedTodayIds };
    },
  });
}
