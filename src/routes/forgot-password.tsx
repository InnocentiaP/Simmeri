import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthLayout } from "@/components/app/AuthLayout";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Reset your password — Simmeri" }],
  }),
  component: ForgotPage,
});

function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Check your email for a reset link.");
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="We'll send a reset link.">
      {sent ? (
        <p className="text-sm text-cocoa">
          If an account exists for <strong>{email}</strong>, a reset link is on the way.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-cocoa">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-olive-deep/50"
            />
          </label>
          <button
            disabled={loading}
            className="mt-2 rounded-full bg-olive-deep px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] hover:bg-olive disabled:opacity-60"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="mt-5 text-sm">
        <Link to="/login" className="text-cocoa hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
