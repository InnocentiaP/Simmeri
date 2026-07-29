import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Minimal, feature-scoped auth check for the recipe-import server function
// only — attached via .middleware([...]) on that one function, never added
// to src/start.ts's global arrays, so it cannot affect any existing route or
// server function. Uses the anon/publishable key purely to validate the
// caller's JWT — never the service-role admin client.
export const importAuthMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const request = getRequest();
    const authHeader = request?.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized");
    }
    const token = authHeader.slice("Bearer ".length);
    if (!token || token.split(".").length !== 3) {
      throw new Error("Unauthorized");
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Recipe import is not configured.");
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw new Error("Unauthorized");
    }

    return next({ context: { userId: data.user.id } });
  },
);
