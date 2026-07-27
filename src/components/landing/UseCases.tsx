const cases = [
  {
    tag: "Solo weeknight",
    title: "Just me, twenty minutes, and what's in the fridge.",
    body: "Open Simmeri, hit Tonight's Deck, and cook something you already have. No scroll spiral.",
  },
  {
    tag: "Family week",
    title: "One plan the whole household actually eats.",
    body: "Drop recipes onto days. Everyone sees the week. The list writes itself.",
  },
  {
    tag: "Empty-fridge night",
    title: "The fridge feels empty. It probably isn't.",
    body: "Simmeri surfaces the three recipes closest to ready with what you have.",
  },
  {
    tag: "Rediscovery",
    title: "That recipe you loved and forgot about.",
    body: "Cooking history brings past favorites back — with your own photos and notes.",
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

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {cases.map((c) => (
            <article key={c.tag} className="paper-card p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-olive-deep">
                {c.tag}
              </p>
              <h3 className="mt-2 font-display text-2xl leading-tight text-coffee">
                {c.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-cocoa/85">{c.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
