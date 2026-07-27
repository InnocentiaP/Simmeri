import { Bookmark, Compass, Refrigerator, ListChecks } from "lucide-react";
import { SimiSpot } from "./SimiSpot";

const items = [
  {
    icon: Bookmark,
    title: "Recipes live everywhere.",
    body: "Bookmarks, screenshots, videos, notes, browser tabs, and saved posts quickly become difficult to search.",
  },
  {
    icon: Compass,
    title: "More saved recipes don't make choosing easier.",
    body: "A large collection can make dinner decisions feel even more overwhelming.",
  },
  {
    icon: Refrigerator,
    title: "The kitchen is full, the possibilities unclear.",
    body: "You may buy ingredients you already have — or forget the ones waiting to be used.",
  },
  {
    icon: ListChecks,
    title: "Plans and lists lose their context.",
    body: "You know what to buy, but not which recipe or planned meal each item belongs to.",
  },
];

export function Problems() {
  return (
    <section aria-labelledby="problems-title" className="relative py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-caramel">
          Why cooking still feels harder than it should
        </p>
        <div className="grid gap-10 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <h2
            id="problems-title"
            className="max-w-xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
          >
            Your recipes are saved. Dinner is still undecided.
          </h2>
          <div className="hidden items-end gap-4 md:flex" aria-hidden>
            <div className="relative h-28 w-28">
              {["-rotate-6", "rotate-3", "-rotate-2"].map((r, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 ${r} rounded-xl border border-border/60 bg-cream/80 shadow-[var(--shadow-soft)]`}
                  style={{ transform: `translate(${i * 6}px, ${i * -4}px) rotate(${i * 6 - 6}deg)` }}
                >
                  <div className="mt-3 h-1.5 w-16 rounded-full bg-cocoa/20 mx-3" />
                  <div className="mt-2 h-1.5 w-10 rounded-full bg-cocoa/15 mx-3" />
                  <div className="mt-2 h-1.5 w-14 rounded-full bg-cocoa/15 mx-3" />
                </div>
              ))}
            </div>
            <span className="mb-8 text-3xl text-cocoa/40">→</span>
            <div className="h-28 w-28 rounded-xl border border-border/70 bg-background p-3 shadow-[var(--shadow-soft)]">
              <div className="h-2 w-14 rounded-full bg-olive-deep/70" />
              <div className="mt-2 space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-cocoa/20" />
                <div className="h-1.5 w-4/5 rounded-full bg-cocoa/20" />
                <div className="h-1.5 w-3/5 rounded-full bg-cocoa/20" />
                <div className="h-1.5 w-4/6 rounded-full bg-cocoa/20" />
              </div>
              <div className="mt-2 flex justify-end">
                <SimiSpot size={28} alt="" />
              </div>
            </div>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-cocoa/85">
            You collect ideas everywhere — but when it&rsquo;s time to cook, those ideas are
            hard to find, compare, or turn into a real plan.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, body }) => (
            <article
              key={title}
              className="paper-card group relative overflow-hidden p-6 transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="font-display text-xl text-coffee">{title}</h3>
              </div>
              <p className="mt-3 text-base leading-relaxed text-cocoa/85">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
