import { BookmarkPlus, Eye, Sparkles, CalendarDays, ShoppingBasket, ChefHat, Camera } from "lucide-react";

const steps = [
  { icon: BookmarkPlus, name: "Capture", body: "Save a recipe from a link, pasted text, or manual entry." },
  { icon: Eye, name: "Review", body: "Check ingredients, steps, source, and image before adding." },
  { icon: Sparkles, name: "Decide", body: "See what's ready to cook or explore a short Tonight's Deck." },
  { icon: CalendarDays, name: "Plan", body: "Add recipes to a day and meal slot." },
  { icon: ShoppingBasket, name: "Shop", body: "Turn missing ingredients into a connected shopping list." },
  { icon: ChefHat, name: "Cook", body: "Follow the recipe and confirm kitchen updates when ready." },
  { icon: Camera, name: "Remember", body: "Add your own cooking photos and notes for next time." },
];

export function Journey() {
  return (
    <section aria-labelledby="journey-title" className="relative bg-cream/60 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-olive-deep">
          Everything comes together
        </p>
        <h2
          id="journey-title"
          className="max-w-2xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          One cozy home for the whole cooking journey.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cocoa/85">
          Simmeri connects the recipes you save with your kitchen, your shopping needs,
          your meal plan, and the dishes you&rsquo;ve already cooked.
        </p>

        <ol className="relative mt-14 grid grid-cols-1 gap-4 md:grid-cols-7">
          {steps.map(({ icon: Icon, name, body }, i) => (
            <li key={name} className="relative">
              <div className="paper-card flex h-full flex-col items-start gap-2 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-olive-deep text-primary-foreground">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-caramel">
                    Step {i + 1}
                  </span>
                </div>
                <h3 className="font-display text-lg text-coffee">{name}</h3>
                <p className="text-sm leading-snug text-cocoa/80">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <blockquote className="mx-auto mt-14 max-w-3xl rounded-3xl border border-border/70 bg-background/70 p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="font-display text-2xl italic leading-snug text-olive-deep md:text-3xl">
            &ldquo;Simmeri helps you make cooking decisions — not just collect more recipes.&rdquo;
          </p>
        </blockquote>
      </div>
    </section>
  );
}
