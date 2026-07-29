import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Signing you in — Simmeri" }] }),
  component: Callback,
});

function Callback() {
  const navigate = useNavigate();
  useEffect(() => {
    // Supabase JS handles code exchange automatically for email confirm & magic links
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
      else navigate({ to: "/login", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream text-cocoa">
      Finishing sign in…
    </div>
  );
}
