import { Shield, Lock, Download, Sparkles } from "lucide-react";
import { SimiSpot } from "./SimiSpot";

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
        <div className="paper-card flex items-center justify-center bg-background p-10">
          <SimiSpot pose="checklist" size={220} alt="Simi holding a small checklist" />
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
