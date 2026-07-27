import simiHero from "@/assets/simi-hero.png.asset.json";
import { EarlyAccessForm } from "./EarlyAccessForm";

export function FinalCTA() {
  return (
    <section
      id="early-access"
      aria-labelledby="cta-title"
      className="relative overflow-hidden py-24"
    >
      <div
        aria-hidden
        className="organic-blob absolute -left-16 top-10 h-80 w-80 bg-duck/40 blur-2xl"
      />
      <div
        aria-hidden
        className="organic-blob absolute -right-20 bottom-0 h-96 w-96 bg-sage/40 blur-2xl"
      />

      <div className="relative mx-auto max-w-4xl px-4 text-center">
        <img
          src={simiHero.url}
          alt="Simi the kitchen duck, ready to cook"
          className="mx-auto h-40 w-auto drop-shadow-[0_16px_20px_rgba(62,42,33,0.25)] sm:h-52"
        />
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-caramel">
          Early access
        </p>
        <h2
          id="cta-title"
          className="mx-auto mt-2 max-w-2xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          Start cooking with Simi.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-cocoa/85">
          Leave your email — Simi will send a warm note when Simmeri is ready for
          your kitchen.
        </p>
        <div className="mt-8">
          <EarlyAccessForm />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          No spam, no pressure. Just one gentle note when it&rsquo;s time.
        </p>
      </div>
    </section>
  );
}
