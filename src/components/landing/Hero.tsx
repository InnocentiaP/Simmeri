import { motion, useReducedMotion } from "motion/react";
import pastaImg from "/images/simmeri/creamy-mushroom-pasta.jpg?url";
import { SimiSpot } from "./SimiSpot";

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section id="top" className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      {/* Organic blobs */}
      <div
        aria-hidden
        className="organic-blob absolute -top-20 -left-24 h-[420px] w-[420px] bg-sage/40 blur-2xl"
      />
      <div
        aria-hidden
        className="organic-blob absolute top-40 -right-20 h-[380px] w-[380px] bg-duck/30 blur-2xl"
      />

      <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-4 md:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border/70 bg-cream px-3 py-1 text-xs font-medium uppercase tracking-widest text-olive-deep">
            <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
            Your recipes, kitchen, and meal ideas — finally together
          </p>
          <h1 className="font-display text-[clamp(2.4rem,6vw,4rem)] leading-[1.02] tracking-tight text-coffee">
            Turn saved recipes into meals{" "}
            <span className="italic text-olive-deep">you&rsquo;ll actually cook.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-cocoa/90">
            Save recipes from anywhere, see what you can make with what you already
            have, plan your meals, and keep every cooking memory in one cozy place.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#early-access"
              className="inline-flex items-center gap-2 rounded-full bg-olive-deep px-6 py-3 text-base font-medium text-primary-foreground shadow-[var(--shadow-cozy)] transition-transform hover:-translate-y-0.5 hover:bg-olive"
            >
              Join the Early Access
              <span aria-hidden>→</span>
            </a>
            <a
              href="#how"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-cream px-6 py-3 text-base font-medium text-cocoa hover:bg-cream-deep/60"
            >
              See How It Works
            </a>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            No complicated pantry tracking. No endless recipe feed.
          </p>
        </div>

        {/* Product mockup composition */}
        <div className="relative mx-auto w-full max-w-md">
          <motion.div
            initial={reduce ? undefined : { opacity: 0, y: 16 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="paper-card relative rounded-[28px] p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-hand text-2xl leading-none text-olive-deep">
                  Good evening,
                </p>
                <p className="font-display text-2xl text-coffee">Maya.</p>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-border/70 bg-cream px-3 py-1 text-xs text-cocoa">
                <span className="h-1.5 w-1.5 rounded-full bg-sage" /> Kitchen ready
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-2xl bg-duck/20 p-3">
              <SimiSpot pose="excited" size={44} />
              <p className="text-sm leading-snug text-cocoa">
                You have <b>three dinner ideas</b> ready with what&rsquo;s already in
                your kitchen.
              </p>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background">
              <div className="relative aspect-[16/9] w-full">
                <img
                  src={pastaImg}
                  alt="Creamy mushroom pasta ready in the Tonight's Deck"
                  width={1280}
                  height={720}
                  className="h-full w-full object-cover"
                />
                <span className="absolute left-3 top-3 rounded-full bg-olive-deep px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                  Ready to cook
                </span>
              </div>
              <div className="flex items-center justify-between p-3">
                <div>
                  <p className="font-display text-base leading-tight text-coffee">
                    Creamy mushroom pasta
                  </p>
                  <p className="text-xs text-muted-foreground">25 min · Cozy</p>
                </div>
                <span className="rounded-full bg-cream-deep px-2.5 py-1 text-[11px] font-medium text-coffee">
                  Cook this
                </span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border/60 bg-cream/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-caramel">
                  Almost ready
                </p>
                <p className="mt-1 font-display text-sm text-coffee">
                  Lentil harvest soup
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">2 missing</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-cream/60 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-olive">
                  Cooked before
                </p>
                <p className="mt-1 font-display text-sm text-coffee">
                  Miso-glazed eggplant
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">Loved it</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-cream-deep/60 p-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cocoa/70">
                  Planned for Wednesday
                </p>
                <p className="font-display text-base text-coffee">Miso-glazed eggplant</p>
              </div>
              <div className="rounded-full bg-olive-deep px-3 py-1 text-xs text-primary-foreground">
                Tonight&rsquo;s Deck →
              </div>
            </div>
          </motion.div>

          {/* Floating chips */}
          <motion.div
            aria-hidden
            initial={reduce ? undefined : { opacity: 0, y: -6, rotate: -6 }}
            animate={reduce ? undefined : { opacity: 1, y: [0, -6, 0], rotate: -6 }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -left-6 top-6 hidden rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-olive-deep shadow-[var(--shadow-soft)] sm:block"
          >
            Uses ingredients you have
          </motion.div>
          <motion.div
            aria-hidden
            initial={reduce ? undefined : { opacity: 0, rotate: 5 }}
            animate={reduce ? undefined : { opacity: 1, y: [0, 6, 0], rotate: 5 }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            className="absolute -right-4 top-32 hidden rounded-full border border-border bg-terracotta/10 px-3 py-1.5 text-xs font-medium text-terracotta shadow-[var(--shadow-soft)] sm:block"
          >
            Only 2 missing
          </motion.div>

          {/* Simi hero */}
          <motion.img
            src="/images/simmeri/simi-fullbody.png"
            alt="Simi the kitchen duck holding a wooden spoon and a My Recipes notebook"
            className="pointer-events-none absolute -bottom-16 -left-38 hidden h-60 w-auto drop-shadow-[0_16px_20px_rgba(62,42,33,0.25)] md:block lg:-left-42"
            initial={reduce ? undefined : { y: 0 }}
            animate={reduce ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    </section>
  );
}
