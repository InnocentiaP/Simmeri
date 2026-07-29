import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "Settings — Simmeri" }] }),
  component: Settings,
});

function Settings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: prefs } = useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("en");
  const [measurement, setMeasurement] = useState("metric");
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name ?? "");
  }, [profile]);
  useEffect(() => {
    if (prefs) {
      setLanguage(prefs.language);
      setMeasurement(prefs.measurement_system);
      setTimezone(prefs.timezone);
    }
  }, [prefs]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const p1 = supabase
        .from("profiles")
        .upsert({ id: user.id, display_name: displayName.trim() || null }, { onConflict: "id" });
      const p2 = supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            language,
            measurement_system: measurement,
            timezone,
          },
          { onConflict: "user_id" },
        );
      const [r1, r2] = await Promise.all([p1, p2]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 font-display text-3xl font-semibold text-olive-deep">Settings</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMut.mutate();
        }}
        className="flex flex-col gap-6"
      >
        <section className="rounded-3xl border border-border/70 bg-background p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-olive-deep">Profile</h2>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-cocoa">Email</span>
              <input
                value={user?.email ?? ""}
                readOnly
                className="rounded-xl border border-border bg-cream-deep/30 px-3 py-2 text-sm text-cocoa/70"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-cocoa">Display name</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="rounded-3xl border border-border/70 bg-background p-5">
          <h2 className="mb-4 font-display text-xl font-semibold text-olive-deep">Preferences</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-cocoa">Language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="en">English</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-cocoa">Measurements</span>
              <select
                value={measurement}
                onChange={(e) => setMeasurement(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="metric">Metric</option>
                <option value="us">US</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-cocoa">Timezone</span>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saveMut.isPending}
            className="rounded-full bg-olive-deep px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-olive disabled:opacity-60"
          >
            {saveMut.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
