import { SimiSpot } from "./SimiSpot";

export function Footer() {
  return (
    <footer className="bg-coffee py-14 text-cream/85">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="flex items-center gap-3">
            <SimiSpot pose="sleepy" size={54} alt="Simi napping in a green nightcap" />
            <div>
              <p className="font-display text-2xl text-cream">Simmeri</p>
              <p className="text-sm text-cream/70">Your cozy cooking companion.</p>
            </div>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="#features" className="hover:text-duck">
              Features
            </a>
            <a href="#how" className="hover:text-duck">
              How it works
            </a>
            <a href="#deck" className="hover:text-duck">
              Tonight&rsquo;s Deck
            </a>
            <a href="#faq" className="hover:text-duck">
              FAQ
            </a>
            <a href="#early-access" className="hover:text-duck">
              Early access
            </a>
          </nav>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-cream/10 pt-6 text-xs text-cream/60 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} Simmeri. Made with warm butter and patience.</p>
          <p className="font-hand text-lg text-duck">Keep the recipe. Remember the moment.</p>
        </div>
      </div>
    </footer>
  );
}
