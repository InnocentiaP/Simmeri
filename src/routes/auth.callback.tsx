import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({ meta: [{ title: "Signing you in — Simmeri" }] }),
  component: Callback,
});

// On an invalid/expired email-confirmation or magic-link, Supabase appends
// error/error_description to the URL hash or query instead of a session —
// surfaced here so the user sees why they landed back on login, rather than
// a silent redirect indistinguishable from "you were never logged in."
function readAuthErrorDescription(): string | null {
  const params = new URLSearchParams(
    window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.search,
  );
  const description = params.get("error_description");
  return description ? description.replace(/\+/g, " ") : null;
}

function Callback() {
  const navigate = useNavigate();
  useEffect(() => {
    // Supabase JS handles code exchange automatically for email confirm & magic links
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/app", replace: true });
        return;
      }
      const errorDescription = readAuthErrorDescription();
      if (errorDescription) {
        toast.error(errorDescription);
      }
      navigate({ to: "/login", replace: true });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream text-cocoa">
      Finishing sign in…
    </div>
  );
}
