import { BookHeart, Salad, Sparkles, CalendarRange, ListChecks, History } from "lucide-react";

const feats = [
  {
    icon: BookHeart,
    title: "Recipe Library",
    body: "Save from links, screenshots, or notes. Every recipe kept beautifully in one collection.",
    span: "md:col-span-2",
    tone: "bg-cream",
  },
  {
    icon: Salad,
    title: "Kitchen Inventory",
    body: "Lightweight tracking of what's on your shelves — no exact grams required.",
    tone: "bg-sage/25",
  },
  {
    icon: Sparkles,
    title: "Tonight's Deck",
    body: "Three cozy recommendations tuned to your kitchen and mood.",
    tone: "bg-duck/30",
  },
  {
    icon: CalendarRange,
    title: "Meal Plan",
    body: "Drag recipes into days and slots. See the week at a glance.",
    span: "md:col-span-2",
    tone: "bg-caramel/15",
  },
  {
    icon: ListChecks,
    title: "Shopping List",
    body: "Built from real recipes and plans, with the source of each item kept.",
    tone: "bg-cream-deep",
  },
  {
    icon: History,
    title: "Cooking History",
    body: "Save your own photos and notes. Rediscover what you loved.",
    span: "md:col-span-2",
    tone: "bg-terracotta/10",
  },
];

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-caramel">
          Core features
        </p>
        <h2
          id="features-title"
          className="max-w-2xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          Small tools that quietly work together.
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-4">
          {feats.map(({ icon: Icon, title, body, span, tone }) => (
            <article
              key={title}
              className={`paper-card ${tone} ${span ?? ""} relative flex flex-col justify-between p-6 transition-transform hover:-translate-y-1`}
            >
              <div>
                <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-background/70 text-olive-deep shadow-[var(--shadow-soft)]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-2xl text-coffee">{title}</h3>
                <p className="mt-2 max-w-md text-base leading-relaxed text-cocoa/85">{body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
