import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MEASUREMENT_PREFERENCE_QUERY_KEY = ["user-preferences", "measurement"] as const;

// The user's preferred measurement system from Settings ("metric" or "us").
// Defaults to metric while loading or when no preference row exists.
export function useMeasurementPreference(): "metric" | "us" {
  const { data } = useQuery({
    queryKey: MEASUREMENT_PREFERENCE_QUERY_KEY,
    queryFn: async () => {
      const { data: prefs, error } = await supabase
        .from("user_preferences")
        .select("measurement_system")
        .maybeSingle();
      if (error) throw error;
      return prefs?.measurement_system ?? "metric";
    },
    staleTime: 5 * 60 * 1000,
  });
  return data === "us" ? "us" : "metric";
}
