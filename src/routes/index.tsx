import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { Problems } from "@/components/landing/Problems";
import { Journey } from "@/components/landing/Journey";
import { Features } from "@/components/landing/Features";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { TonightsDeck } from "@/components/landing/TonightsDeck";
import { Planning } from "@/components/landing/Planning";
import { UseCases } from "@/components/landing/UseCases";
import { Benefits } from "@/components/landing/Benefits";
import { Trust } from "@/components/landing/Trust";
import { WhoFor } from "@/components/landing/WhoFor";
import { FAQ } from "@/components/landing/FAQ";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";

const SITE_TITLE = "Simmeri — Your cozy cooking companion";
const SITE_DESC =
  "Save recipes from anywhere, see what you can cook with what you have, plan meals, and keep every cooking memory in one cozy place.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: SITE_TITLE },
      { name: "description", content: SITE_DESC },
      { property: "og:title", content: SITE_TITLE },
      { property: "og:description", content: SITE_DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SITE_TITLE },
      { name: "twitter:description", content: SITE_DESC },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main>
        <Hero />
        <Problems />
        <Journey />
        <Features />
        <HowItWorks />
        <TonightsDeck />
        <Planning />
        <UseCases />
        <Benefits />
        <Trust />
        <WhoFor />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
