import { Link2, Sparkles, Clock, ShoppingBasket } from "lucide-react";
import { SimiSpot } from "./SimiSpot";

const steps = [
  {
    tag: "01 · Capture & Review",
    title: "Save the recipe once. Find it forever.",
    body: "Paste a link, drop a screenshot, or type it out. Simmeri gently pulls out ingredients, steps, and the source so nothing lives in a random tab again.",
    vignette: "capture" as const,
  },
  {
    tag: "02 · Kitchen check-in",
    title: "Tell Simi what's on your shelves.",
    body: "A quick tap says 'good', 'running low', or 'out'. That's all Simmeri needs to know what you can cook tonight — no scales, no barcodes.",
    vignette: "kitchen" as const,
  },
  {
    tag: "03 · Decide with Tonight's Deck",
    title: "Three cozy ideas. One clear pick.",
    body: "Simi hands you a short deck of recipes ready with what you already have, plus a couple that only need one thing. Swipe, save, or cook.",
    vignette: "deck" as const,
  },
  {
    tag: "04 · Plan, shop, remember",
    title: "From plan to plate to memory.",
    body: "Drop meals onto your week. Simmeri builds the shopping list. After you cook, add a photo and a note — future you will be glad.",
    vignette: "plan" as const,
  },
];

function Vignette({ kind }: { kind: (typeof steps)[number]["vignette"] }) {
  if (kind === "capture") {
    return (
      <div className="flex w-full max-w-sm flex-col gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background px-3 py-2.5">
          <Link2 className="h-4 w-4 text-olive-deep" />
          <span className="truncate text-xs text-cocoa/70">
            smittenkitchen.com/creamy-mushroom-pasta
          </span>
          <span className="ml-auto rounded-full bg-olive-deep px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
            Save
          </span>
        </div>
        <div className="rounded-2xl border border-border/60 bg-cream/60 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-caramel" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-caramel">
              Simi parsed this recipe
            </p>
          </div>
          <p className="mt-2 font-display text-lg text-coffee">Creamy mushroom pasta</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Mushrooms", "Cream", "Garlic", "Parmesan", "+4"].map((c) => (
              <span
                key={c}
                className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-cocoa"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }
  if (kind === "kitchen") {
    const rows = [
      { name: "Mushrooms", state: "Good", tone: "bg-sage/30 text-olive-deep" },
      { name: "Cream", state: "Running low", tone: "bg-caramel/25 text-caramel" },
      { name: "Parmesan", state: "Out", tone: "bg-terracotta/20 text-terracotta" },
    ];
    return (
      <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-background p-4">
        <p className="font-hand text-xl text-olive-deep">Kitchen</p>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => (
            <li
              key={r.name}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-cream/40 px-3 py-2"
            >
              <span className="text-sm font-medium text-coffee">{r.name}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${r.tone}`}>
                {r.state}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (kind === "deck") {
    const mini = [
      { tag: "Ready", tone: "bg-cream", title: "Mushroom pasta" },
      { tag: "Almost", tone: "bg-cream-deep", title: "Lentil soup" },
      { tag: "Cozy", tone: "bg-duck/40", title: "Miso eggplant" },
    ];
    return (
      <div className="relative h-56 w-full max-w-sm">
        {mini.map((c, i) => (
          <div
            key={c.title}
            className={`absolute inset-x-6 top-2 flex h-48 flex-col justify-between rounded-2xl border border-border/60 p-4 shadow-[var(--shadow-soft)] ${c.tone}`}
            style={{
              transform: `translate(${i * 10}px, ${i * -10}px) rotate(${i * 3 - 3}deg)`,
              zIndex: 10 - i,
            }}
          >
            <span className="w-fit rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-cocoa/80">
              {c.tag}
            </span>
            <div>
              <p className="font-hand text-lg leading-none text-olive-deep">Tonight</p>
              <p className="font-display text-lg leading-tight text-coffee">{c.title}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }
  // plan
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const filled: Record<number, string> = { 0: "Oats", 2: "Miso", 4: "Pasta" };
  return (
    <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-background p-4">
      <div className="flex items-center justify-between">
        <p className="font-hand text-xl text-olive-deep">This week</p>
        <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] text-cocoa">
          Nov 4–10
        </span>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => (
          <div
            key={i}
            className="flex h-16 flex-col items-center justify-between rounded-lg border border-border/60 bg-cream/40 p-1"
          >
            <span className="text-[10px] font-semibold text-cocoa/60">{d}</span>
            {filled[i] && (
              <span className="w-full rounded-md bg-duck/50 px-1 py-0.5 text-center text-[10px] leading-none text-coffee">
                {filled[i]}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-sage/20 px-3 py-2">
        <ShoppingBasket className="h-4 w-4 text-olive-deep" />
        <p className="text-xs text-cocoa/85">
          <b>3 items</b> to buy for the week
        </p>
        <Clock className="ml-auto h-3.5 w-3.5 text-cocoa/60" />
      </div>
    </div>
  );
}

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
              <div className="paper-card relative flex items-center justify-center bg-background p-8">
                <Vignette kind={s.vignette} />
                <div className="pointer-events-none absolute -bottom-4 -right-3">
                  <SimiSpot size={64} alt="" />
                </div>
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
