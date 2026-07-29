import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AuthLayout } from "@/components/app/AuthLayout";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — Simmeri" },
      { name: "description", content: "Start your cozy cooking journey with Simmeri." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { display_name: displayName || null },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Welcome to Simmeri");
      navigate({ to: "/app" });
    } else {
      toast.success("Check your email to confirm your account.");
      navigate({ to: "/login" });
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="A cozy home for every recipe you love.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-cocoa">Display name</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-olive-deep/50"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-cocoa">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-olive-deep/50"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-cocoa">Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-olive-deep/50"
          />
          <span className="text-xs text-muted-foreground">At least 8 characters.</span>
        </label>
        <button
          disabled={loading}
          className="mt-2 rounded-full bg-olive-deep px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)] hover:bg-olive disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-sm text-cocoa">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-olive-deep hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
