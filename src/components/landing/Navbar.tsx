import { useEffect, useState } from "react";

const links = [
  { href: "#how", label: "How It Works" },
  { href: "#deck", label: "Tonight's Deck" },
  { href: "#planning", label: "Meal Planning" },
  { href: "#pricing", label: "Plans" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div className="mx-auto max-w-6xl px-4">
        <nav
          className={`flex items-center justify-between rounded-full border border-border/70 bg-cream/85 px-4 py-2 backdrop-blur transition-shadow ${
            scrolled ? "shadow-[var(--shadow-soft)]" : ""
          }`}
        >
          <a href="#top" className="flex min-w-0 shrink items-center gap-2.5">
            <img
              src="/images/simmeri/simi-logo.png"
              alt="Simi mark"
              className="h-11 w-auto shrink-0 object-contain -my-1.5"
              draggable={false}
            />
            <span className="truncate font-display text-2xl font-semibold tracking-tight text-olive-deep">
              Simmeri
            </span>
          </a>
          <ul className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="rounded-full px-3 py-1.5 text-sm text-cocoa transition-colors hover:bg-cream-deep/60 hover:text-olive-deep"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <a
              href="/login"
              className="hidden rounded-full px-3 py-1.5 text-sm text-cocoa hover:bg-cream-deep/60 sm:inline-block"
            >
              Log in
            </a>
            <a
              href="#early-access"
              className="inline-flex shrink-0 items-center rounded-full bg-olive-deep px-3 py-2 text-xs font-medium whitespace-nowrap text-primary-foreground shadow-[var(--shadow-soft)] transition-transform hover:-translate-y-0.5 hover:bg-olive sm:px-4 sm:text-sm"
            >
              Join Early Access
            </a>
            <button
              type="button"
              aria-label="Toggle menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-cocoa md:hidden"
            >
              <span aria-hidden className="text-lg leading-none">
                {open ? "×" : "≡"}
              </span>
            </button>
          </div>
        </nav>
        {open && (
          <div className="mt-2 rounded-3xl border border-border/70 bg-cream p-3 shadow-[var(--shadow-paper)] md:hidden">
            <a
              href="/login"
              onClick={() => setOpen(false)}
              className="block rounded-2xl bg-olive-deep/10 px-4 py-2.5 text-sm font-medium text-olive-deep hover:bg-olive-deep/15"
            >
              Log in
            </a>
            <div className="my-2 h-px bg-border/70" aria-hidden />
            <ul className="flex flex-col">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-2xl px-4 py-2.5 text-sm text-cocoa hover:bg-cream-deep/60"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
