import { Heart, Clock, Flame, CalendarPlus, Undo2, BookOpen, X } from "lucide-react";
import simiFullbody from "@/assets/simi-fullbody.png.asset.json";
import pastaImg from "/images/simmeri/creamy-mushroom-pasta.jpg?url";
import misoImg from "/images/simmeri/miso-noodle-soup.jpg?url";
import tofuImg from "/images/simmeri/crispy-tofu-rice-bowl.jpg?url";

const layered = [
  { title: "Crispy tofu rice bowl", img: tofuImg, tag: "Cozy pick", rotate: 6, offset: 28 },
  { title: "Miso noodle soup", img: misoImg, tag: "Almost ready", rotate: 3, offset: 14 },
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
            endless feed. Skip what doesn&rsquo;t feel right, shortlist what does, or send it
            straight to the pan.
          </p>
          <a
            href="#early-access"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-duck px-6 py-3 text-base font-medium text-coffee shadow-[var(--shadow-cozy)] transition-transform hover:-translate-y-0.5"
          >
            Join the Early Access →
          </a>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="relative h-[540px] w-full">
            {/* Back layered cards */}
            {layered.map((c, i) => (
              <div
                key={c.title}
                className={`absolute inset-x-6 top-0 rounded-[28px] border border-border/50 p-5 shadow-[var(--shadow-cozy)] ${c.tone}`}
                style={{
                  transform: `translate(${c.offset}px, ${-i * 6 - 6}px) rotate(${c.rotate}deg)`,
                  zIndex: 5 - i,
                  height: "88%",
                }}
              >
                <span className="rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-cocoa/80">
                  Almost ready
                </span>
                <p className="mt-4 font-hand text-xl text-olive-deep">Tonight</p>
                <p className="font-display text-2xl leading-tight text-coffee">
                  {c.title}
                </p>
              </div>
            ))}

            {/* Active card */}
            <article
              className="absolute inset-x-0 top-4 z-10 overflow-hidden rounded-[28px] bg-background text-coffee shadow-[var(--shadow-cozy)]"
              style={{ transform: "rotate(-2deg)" }}
            >
              <div className="relative aspect-[4/3] w-full">
                <img
                  src={pastaImg}
                  alt="Creamy mushroom pasta in a ceramic bowl"
                  loading="lazy"
                  width={1280}
                  height={960}
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-3 top-3 rounded-full bg-olive-deep px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                  Ready to cook
                </span>
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium text-coffee">
                  <Clock className="h-3 w-3" /> 25 min
                </span>
              </div>
              <div className="p-5">
                <h3 className="font-display text-2xl leading-tight">
                  Creamy mushroom pasta
                </h3>
                <p className="mt-1 text-sm text-cocoa/80">
                  You already have every core ingredient.
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-olive-deep">
                  <Undo2 className="h-3 w-3" /> Cooked once before
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1 rounded-full border border-border/70 bg-cream/50 px-2 py-2 text-[11px] font-medium text-cocoa"
                  >
                    <X className="h-3 w-3" /> Not tonight
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1 rounded-full border border-border/70 bg-cream/50 px-2 py-2 text-[11px] font-medium text-cocoa"
                  >
                    <Heart className="h-3 w-3" /> Shortlist
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1 rounded-full border border-border/70 bg-cream/50 px-2 py-2 text-[11px] font-medium text-cocoa"
                  >
                    <BookOpen className="h-3 w-3" /> View
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-1 rounded-full border border-border/70 bg-cream/50 px-2 py-2 text-[11px] font-medium text-cocoa"
                  >
                    <CalendarPlus className="h-3 w-3" /> Plan
                  </button>
                  <button
                    type="button"
                    className="col-span-2 flex items-center justify-center gap-1 rounded-full bg-olive-deep px-3 py-2 text-[12px] font-semibold text-primary-foreground"
                  >
                    <Flame className="h-3.5 w-3.5" /> Cook this
                  </button>
                </div>
              </div>
            </article>
          </div>

          <img
            src={simiFullbody.url}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-6 -right-4 h-32 w-auto rotate-6 drop-shadow-[0_16px_20px_rgba(0,0,0,0.35)] sm:h-40"
          />
        </div>
      </div>
    </section>
  );
}
