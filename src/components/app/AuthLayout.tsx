import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream/50 px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <img src="/images/simmeri/simi-logo.png" alt="Simmeri" className="h-10 w-auto" />
          <span className="font-display text-2xl font-semibold text-olive-deep">Simmeri</span>
        </Link>
        <div className="rounded-3xl border border-border/70 bg-background p-6 shadow-[var(--shadow-paper)] sm:p-8">
          <h1 className="font-display text-2xl font-semibold text-olive-deep">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-cocoa/80">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
