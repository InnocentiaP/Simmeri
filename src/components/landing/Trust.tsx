import { Shield, Lock, Download, Sparkles, Check } from "lucide-react";


const points = [
  { icon: Lock, title: "Your recipes stay yours.", body: "Private by default. Nothing shared without you." },
  { icon: Shield, title: "No ads, no reselling.", body: "Simmeri isn't paid to point you at any brand." },
  { icon: Download, title: "Export anytime.", body: "Take your library, plans, and photos with you." },
  { icon: Sparkles, title: "Gentle helpers, not push notifications.", body: "Simi nudges quietly, never bosses." },
];

export function Trust() {
  return (
    <section aria-labelledby="trust-title" className="bg-cream/60 py-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 md:grid-cols-[1fr_1.2fr]">
        <div className="paper-card relative overflow-hidden bg-background p-8">
          <div className="mx-auto w-full max-w-xs">
            <div className="rounded-3xl border border-border/70 bg-cream/50 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-olive-deep text-primary-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-display text-base text-coffee">Private by default</p>
                  <p className="text-[11px] text-cocoa/70">Only you can see your kitchen.</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {[
                  "Your recipe library",
                  "Cooking history & photos",
                  "Meal plans & shopping",
                ].map((label) => (
                  <li
                    key={label}
                    className="flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-coffee"
                  >
                    <Check className="h-3.5 w-3.5 text-olive-deep" />
                    {label}
                    <span className="ml-auto rounded-full bg-sage/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-olive-deep">
                      Private
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-olive-deep px-4 py-2.5 text-sm font-medium text-primary-foreground"
              >
                <Download className="h-4 w-4" />
                Export my data
              </button>
            </div>
          </div>
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-caramel">
            Trust & control
          </p>
          <h2
            id="trust-title"
            className="font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
          >
            A small kitchen companion — not another data-hungry app.
          </h2>
          <ul className="mt-8 space-y-4">
            {points.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-2xl bg-olive-deep text-primary-foreground">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-display text-lg text-coffee">{title}</p>
                  <p className="text-sm text-cocoa/85">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
