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
          <div className="hidden items-end gap-4 md:flex">
            <SimiSpot pose="concerned" size={110} alt="Simi looking a little overwhelmed" />
            <span aria-hidden className="mb-8 text-3xl text-cocoa/40">
              →
            </span>
            <SimiSpot pose="checking" size={110} alt="Simi with an organized notebook" />
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
