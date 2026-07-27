const benefits = [
  { title: "Less decision fatigue", body: "Short decks beat endless feeds." },
  { title: "Less food waste", body: "Cook with what's already on your shelves." },
  { title: "Calmer weeks", body: "A plan that fits real life, not a spreadsheet." },
  { title: "Fewer grocery trips", body: "Shopping lists that come from real recipes." },
  { title: "More cooking memories", body: "Photos and notes travel with each recipe." },
  { title: "Your recipes, one home", body: "Every source, one calm library." },
];

export function Benefits() {
  return (
    <section aria-labelledby="benefits-title" className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-olive-deep">
          Benefits
        </p>
        <h2
          id="benefits-title"
          className="max-w-2xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          Small changes. Warmer weeks.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-border/70 bg-cream/60 p-5 transition-transform hover:-translate-y-0.5"
            >
              <p className="font-display text-lg text-coffee">{b.title}</p>
              <p className="mt-1 text-sm text-cocoa/85">{b.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
