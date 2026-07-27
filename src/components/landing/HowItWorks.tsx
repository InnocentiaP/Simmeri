import { SimiSpot } from "./SimiSpot";

const steps = [
  {
    pose: "gathering" as const,
    tag: "01 · Capture & Review",
    title: "Save the recipe once. Find it forever.",
    body: "Paste a link, drop a screenshot, or type it out. Simmeri gently pulls out ingredients, steps, and the source so nothing lives in a random tab again.",
  },
  {
    pose: "checking" as const,
    tag: "02 · Kitchen check-in",
    title: "Tell Simi what's on your shelves.",
    body: "A quick tap says 'good', 'running low', or 'out'. That's all Simmeri needs to know what you can cook tonight — no scales, no barcodes.",
  },
  {
    pose: "cooking" as const,
    tag: "03 · Decide with Tonight's Deck",
    title: "Three cozy ideas. One clear pick.",
    body: "Simi hands you a short deck of recipes ready with what you already have, plus a couple that only need one thing. Swipe, save, or cook.",
  },
  {
    pose: "shopping" as const,
    tag: "04 · Plan, shop, remember",
    title: "From plan to plate to memory.",
    body: "Drop meals onto your week. Simmeri builds the shopping list. After you cook, add a photo and a note — future you will be glad.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="bg-cream/60 py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-olive-deep">
          How it works
        </p>
        <h2
          id="how-title"
          className="max-w-2xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          Four small habits. One calmer kitchen.
        </h2>

        <div className="mt-14 flex flex-col gap-12">
          {steps.map((s, i) => (
            <article
              key={s.tag}
              className={`grid items-center gap-8 md:grid-cols-[1fr_1.3fr] ${
                i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div className="paper-card flex items-center justify-center bg-background p-8">
                <SimiSpot pose={s.pose} size={200} alt={`Simi — ${s.tag}`} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-caramel">
                  {s.tag}
                </p>
                <h3 className="mt-2 font-display text-3xl leading-tight text-coffee">
                  {s.title}
                </h3>
                <p className="mt-3 max-w-lg text-base leading-relaxed text-cocoa/85">
                  {s.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
