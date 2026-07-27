import { Check, Sparkles } from "lucide-react";

const freeFeatures = [
  "Manual recipe creation",
  "Personal recipe library",
  "Basic Kitchen statuses",
  "Cooking readiness",
  "Shopping List",
  "Cooking History",
  "Basic dashboard suggestions",
];

const premiumFeatures = [
  "Higher configurable recipe limits",
  "URL and pasted-text recipe imports",
  "Expanded recipe & cooking-photo storage",
  "Full Tonight's Deck access",
  "Daily and weekly Meal Planning",
  "Enhanced suggestions",
  "Higher applicable usage limits",
];

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-olive-deep">
          Simple plans
        </p>
        <h2
          id="pricing-title"
          className="max-w-3xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          Start with the essentials. Upgrade when you want more room to cook.
        </h2>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cocoa/85">
          Simmeri&rsquo;s Free plan keeps the core cooking journey useful. Premium adds
          more capacity, convenience, and decision support.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Free */}
          <article className="paper-card flex flex-col bg-background p-8">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-3xl text-coffee">Free</h3>
              <span className="rounded-full bg-sage/30 px-3 py-1 text-xs font-semibold text-olive-deep">
                Free
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-cocoa/80">
              A practical starting point for organizing recipes and cooking with what
              you have.
            </p>
            <ul className="mt-6 space-y-3">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-coffee">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-olive-deep" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#early-access"
              className="mt-8 inline-flex items-center justify-center rounded-full border border-border bg-cream px-6 py-3 text-base font-medium text-cocoa hover:bg-cream-deep/60"
            >
              Join the Early Access
            </a>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Useful from the first recipe.
            </p>
          </article>

          {/* Premium */}
          <article className="paper-card relative flex flex-col border-olive-deep/40 bg-cream/60 p-8 shadow-[var(--shadow-cozy)]">
            <span className="absolute -top-3 left-8 inline-flex items-center gap-1 rounded-full bg-olive-deep px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary-foreground">
              <Sparkles className="h-3 w-3" /> Most flexible
            </span>
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-3xl text-coffee">Premium</h3>
              <span className="rounded-full bg-caramel/25 px-3 py-1 text-xs font-semibold text-caramel">
                Pricing at launch
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-cocoa/80">
              For cooks who want more automation, planning, storage, and decision
              support.
            </p>
            <ul className="mt-6 space-y-3">
              {premiumFeatures.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-coffee">
                  <Check className="mt-0.5 h-4 w-4 flex-none text-olive-deep" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="#early-access"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-olive-deep px-6 py-3 text-base font-medium text-primary-foreground shadow-[var(--shadow-soft)] hover:bg-olive"
            >
              Join the Early Access
            </a>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Be the first to hear when Premium launches.
            </p>
          </article>
        </div>

        <p className="mt-8 max-w-3xl text-xs text-muted-foreground">
          Pricing and usage limits are shown as a transparent product preview and
          will be finalized at launch. No payment is collected during early access.
        </p>
      </div>
    </section>
  );
}
