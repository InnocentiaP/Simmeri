import savedRecipe from "/images/simmeri/saved-recipe-kitchen.jpg?url";
import fullFridge from "/images/simmeri/full-fridge-no-ideas.jpg?url";
import weeklyGrocery from "/images/simmeri/weekly-grocery-planning.jpg?url";
import familyDinner from "/images/simmeri/family-favorite-dinner.jpg?url";

const cases = [
  {
    tag: "The Saved Recipe",
    body: "Finally cook the recipe you saved months ago.",
    img: savedRecipe,
    alt: "A home cook consulting a recipe on a tablet while prepping vegetables in a warm kitchen",
  },
  {
    tag: "Full Fridge, No Ideas",
    body: "Find recipes that use what you already have.",
    img: fullFridge,
    alt: "An open home refrigerator filled with everyday ingredients",
  },
  {
    tag: "Weekly Grocery Run",
    body: "Build your list from the recipes you actually plan to cook.",
    img: weeklyGrocery,
    alt: "Fresh groceries on a warm wooden kitchen table with a reusable bag and phone",
  },
  {
    tag: "Old Favorites",
    body: "Bring back meals you loved — and remember what worked.",
    img: familyDinner,
    alt: "Family and friends sharing a relaxed home-cooked dinner around a wooden table",
  },
];

export function UseCases() {
  return (
    <section aria-labelledby="uc-title" className="bg-cream/60 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-caramel">
          Use cases
        </p>
        <h2
          id="uc-title"
          className="max-w-2xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          Different nights. Same calm kitchen.
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {cases.map((c) => (
            <article
              key={c.tag}
              className="paper-card overflow-hidden bg-background p-0"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <img
                  src={c.img}
                  alt={c.alt}
                  loading="lazy"
                  width={1280}
                  height={960}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6">
                <h3 className="font-display text-2xl leading-tight text-coffee">
                  {c.tag}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-cocoa/85">
                  {c.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
