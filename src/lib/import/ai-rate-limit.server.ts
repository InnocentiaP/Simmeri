// Best-effort, in-memory, per-user rate limiter shared by every AI Recipe
// feature (Import's "Improve with AI"/"Try AI again" and Edit's "Clean up
// with AI") — one shared budget per user across both entry points, since
// both ultimately call the same Gemini API/key and the point of this limiter
// is bounding overall AI usage, not per-feature usage.
//
// Explicitly NOT a durable quota system: it resets on cold start and is not
// shared across concurrent serverless instances, so it is a soft speed-bump,
// not an enforced limit. A persisted (e.g. Supabase-backed) usage counter
// would be the natural upgrade path if real abuse is ever observed —
// deliberately not built now, matching the "smallest practical" rate-limit
// decision made for the original AI Recipe Import Assistant checkpoint.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_CALLS = 10;
const callHistory = new Map<string, number[]>();

export function isAiRateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (callHistory.get(userId) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_CALLS) {
    callHistory.set(userId, recent);
    return true;
  }
  recent.push(now);
  callHistory.set(userId, recent);
  return false;
}
