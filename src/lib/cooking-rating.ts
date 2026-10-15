// Shared vocabulary for cooking_history.rating. Values mirror the
// cooking_history_rating_check constraint exactly.

export const COOKING_RATINGS = ["loved", "good", "meh"] as const;
export type CookingRating = (typeof COOKING_RATINGS)[number];

export function isCookingRating(value: unknown): value is CookingRating {
  return typeof value === "string" && (COOKING_RATINGS as readonly string[]).includes(value);
}

export function cookingRatingLabel(rating: CookingRating): string {
  switch (rating) {
    case "loved":
      return "Loved it";
    case "good":
      return "Good";
    case "meh":
      return "Meh";
  }
}

export function cookingRatingEmoji(rating: CookingRating): string {
  switch (rating) {
    case "loved":
      return "😍";
    case "good":
      return "🙂";
    case "meh":
      return "😐";
  }
}
