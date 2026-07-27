import { Star, X, Heart, Clock } from "lucide-react";
import simiFullbody from "@/assets/simi-fullbody.png.asset.json";

const cards = [
  { title: "Creamy mushroom pasta", time: "25 min", tag: "Ready to cook", tone: "bg-cream" },
  { title: "Lentil harvest soup", time: "35 min", tag: "2 missing", tone: "bg-cream-deep" },
  { title: "Miso-glazed eggplant", time: "30 min", tag: "Cozy pick", tone: "bg-duck/40" },
];

export function TonightsDeck() {
  return (
    <section
      id="deck"
      aria-labelledby="deck-title"
      className="relative overflow-hidden bg-coffee py-24 text-primary-foreground"
    >
      <div
        aria-hidden
        className="organic-blob absolute -top-24 right-0 h-96 w-96 bg-terracotta/30 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-duck">
            Tonight&rsquo;s Deck
          </p>
          <h2
            id="deck-title"
            className="font-display text-4xl leading-[1.05] tracking-tight md:text-5xl"
          >
            Three ideas. A little breath. Dinner decided.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-cream/85">
            When you don&rsquo;t know what to cook, Simi hands you a short deck instead of an
            endless feed. Swipe past what doesn&rsquo;t feel right, star what does, or heart it
            to plan for later.
          </p>
          <a
            href="#early-access"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-duck px-6 py-3 text-base font-medium text-coffee shadow-[var(--shadow-cozy)] transition-transform hover:-translate-y-0.5"
          >
            Try Tonight&rsquo;s Deck →
          </a>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="relative aspect-[3/4]">
            {cards.map((c, i) => (
              <div
                key={c.title}
                className={`absolute inset-0 flex flex-col justify-between rounded-[28px] border border-border/50 p-6 shadow-[var(--shadow-cozy)] ${c.tone}`}
                style={{
                  transform: `translate(${i * 14}px, ${i * -18}px) rotate(${i * 4 - 4}deg)`,
                  zIndex: 10 - i,
                }}
              >
                <div className="flex items-center justify-between text-cocoa/80">
                  <span className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest">
                    {c.tag}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Clock className="h-3.5 w-3.5" /> {c.time}
                  </span>
                </div>
                <div>
                  <p className="font-hand text-2xl text-olive-deep">Tonight</p>
                  <h3 className="mt-1 font-display text-3xl leading-tight text-coffee">
                    {c.title}
                  </h3>
                  <div className="mt-6 flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Not tonight"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-background/90 text-cocoa"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Star this pick"
                      className="flex h-13 w-13 items-center justify-center rounded-full bg-olive-deep p-3 text-primary-foreground"
                    >
                      <Star className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Save for later"
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-terracotta/90 text-primary-foreground"
                    >
                      <Heart className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <img
            src={simiFullbody.url}
            alt="Simi peeking from behind the deck of recipe cards"
            className="pointer-events-none absolute -bottom-8 -right-6 h-36 w-auto rotate-6 drop-shadow-[0_16px_20px_rgba(0,0,0,0.35)] sm:h-44"
          />
        </div>
      </div>
    </section>
  );
}
