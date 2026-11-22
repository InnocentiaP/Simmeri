import { useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createIngredientMatcher, type IngredientKeyFn, type MatcherData } from "./matcher";

export const INGREDIENT_MATCHER_QUERY_KEY = ["ingredient-matcher"] as const;
const STALE_MS = 5 * 60 * 1000;

// Global catalog aliases + the user's own aliases (RLS returns both) and the
// user's personal "same as" links. Each part degrades to empty on error —
// e.g. before the Phase 2 migration is applied — so matching falls back to
// plain text (with plural handling) instead of breaking any page.
// Plus each canonical ingredient's stable key (e.g. "flour"), used by
// features keyed on the catalog such as measurement conversion.
type CatalogData = MatcherData & { canonicalKeys: Readonly<Record<string, string>> };

async function fetchMatcherData(): Promise<CatalogData> {
  const [session, aliasRes, linkRes, canonicalRes] = await Promise.all([
    supabase.auth.getSession(),
    supabase
      .from("ingredient_aliases")
      .select("canonical_ingredient_id, normalized_alias, owner_user_id"),
    supabase.from("user_ingredient_links").select("alias_normalized, target_normalized"),
    supabase.from("canonical_ingredients").select("id, canonical_key"),
  ]);
  const canonicalKeys: Record<string, string> = {};
  for (const row of canonicalRes.error ? [] : (canonicalRes.data ?? [])) {
    canonicalKeys[row.id] = row.canonical_key;
  }
  return {
    aliases: aliasRes.error ? [] : (aliasRes.data ?? []),
    links: linkRes.error ? [] : (linkRes.data ?? []),
    userId: session.data.session?.user.id ?? null,
    canonicalKeys,
  };
}

const matcherByData = new WeakMap<MatcherData, IngredientKeyFn>();
function matcherFor(data: MatcherData): IngredientKeyFn {
  let matcher = matcherByData.get(data);
  if (!matcher) {
    matcher = createIngredientMatcher(data);
    matcherByData.set(data, matcher);
  }
  return matcher;
}

const queryOptions = {
  queryKey: INGREDIENT_MATCHER_QUERY_KEY,
  queryFn: fetchMatcherData,
  staleTime: STALE_MS,
};

// For use inside other queries' queryFns (readiness, recommendations, …).
export async function getIngredientMatcher(queryClient: QueryClient): Promise<IngredientKeyFn> {
  return matcherFor(await queryClient.fetchQuery(queryOptions));
}

// For components. Undefined while loading; callers then fall back to the
// functions' default exact-text matching.
export function useIngredientMatcher(): IngredientKeyFn | undefined {
  const { data } = useQuery(queryOptions);
  return useMemo(() => (data ? matcherFor(data) : undefined), [data]);
}

// For components: name → canonical key ("flour", "sugar", …) or null when
// the name isn't in the catalog. Undefined while loading.
export function useCanonicalKeyOf(): ((name: string) => string | null) | undefined {
  const { data } = useQuery(queryOptions);
  return useMemo(() => {
    if (!data) return undefined;
    const keyOf = matcherFor(data);
    return (name: string) => {
      const key = keyOf(name);
      return key.startsWith("c:") ? (data.canonicalKeys[key.slice(2)] ?? null) : null;
    };
  }, [data]);
}
