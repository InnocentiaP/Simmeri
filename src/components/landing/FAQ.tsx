import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const items = [
  {
    q: "Is Simmeri another recipe feed?",
    a: "No. Simmeri holds only the recipes you save. Nothing algorithmic, no infinite scroll. Your library, your pace.",
  },
  {
    q: "Do I have to track every ingredient in my kitchen?",
    a: "Never. Simmeri uses light states — 'good', 'running low', 'out'. Enough to help you decide, not enough to feel like a chore.",
  },
  {
    q: "Can I save recipes from Instagram, TikTok, or blogs?",
    a: "Yes. Paste a link, drop a screenshot, or type it in. Simmeri pulls out the parts that matter.",
  },
  {
    q: "How does Tonight's Deck decide what to show?",
    a: "It looks at your kitchen, your recent cooking, and how ready each recipe is. Three cozy picks — that's it.",
  },
  {
    q: "Will Simmeri work offline?",
    a: "Your saved recipes and plans stay readable. Syncing happens when you're back online.",
  },
  {
    q: "Is Simi always this cheerful?",
    a: "Almost. Simi is curious, warm, and a little sparkly — never judgmental about last night's takeout.",
  },
  {
    q: "How much will Simmeri cost?",
    a: "A generous free tier for personal use, with an optional paid tier for household planning. Details as we get closer to launch.",
  },
];

export function FAQ() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-cream/60 py-24">
      <div className="mx-auto max-w-3xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-caramel">
          FAQ
        </p>
        <h2
          id="faq-title"
          className="font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          The small questions, gently answered.
        </h2>

        <Accordion type="single" collapsible className="mt-10">
          {items.map((it, i) => (
            <AccordionItem key={it.q} value={`item-${i}`} className="border-border/70">
              <AccordionTrigger className="text-left font-display text-lg text-coffee hover:no-underline">
                {it.q}
              </AccordionTrigger>
              <AccordionContent className="text-base leading-relaxed text-cocoa/85">
                {it.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
