const groups = [
  "Students learning to cook",
  "Busy professionals",
  "Couples planning together",
  "Families with a shared week",
  "Casual home cooks",
  "Recipe collectors from Instagram",
  "TikTok save-hoarders",
  "Anyone tired of 'what's for dinner?'",
];

export function WhoFor() {
  return (
    <section aria-labelledby="who-title" className="py-24">
      <div className="mx-auto max-w-6xl px-4 text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-olive-deep">
          Who it&rsquo;s for
        </p>
        <h2
          id="who-title"
          className="mx-auto max-w-2xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          Made for people who want cooking to feel a little cozier.
        </h2>
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
          {groups.map((g) => (
            <span
              key={g}
              className="rounded-full border border-border bg-cream px-4 py-2 text-sm text-cocoa"
            >
              {g}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
