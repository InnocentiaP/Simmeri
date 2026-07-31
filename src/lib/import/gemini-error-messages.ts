import type { GeminiCallResult } from "./gemini-client.server";

// Type-only import above is fully erased at runtime (no module resolution
// occurs for it), so this file stays a pure, dependency-free module safe to
// import from both server functions and node:test — it never actually loads
// gemini-client.server.ts's fetch/env-reading code.
type GeminiFailureCategory = Extract<GeminiCallResult, { ok: false }>["category"];

// Shared by every AI Recipe feature's server function (Import and Edit) so
// the safe, non-leaking client-facing wording for each failure category
// never drifts between the two. Every message here intentionally omits any
// internal detail (status codes, hostnames, provider error bodies) — see
// gemini-client.server.ts's own devLog for where that detail is logged
// instead (dev-only, never in production).
export const AI_MALFORMED_RESPONSE_MESSAGE =
  "The AI assistant returned an unexpected response. Try again or keep your current draft.";

export const AI_RATE_LIMIT_EXCEEDED_MESSAGE =
  "You've reached the AI assistance limit for now — try again shortly, or continue editing manually.";

export function mapGeminiErrorToUserMessage(category: GeminiFailureCategory): string {
  switch (category) {
    case "not_configured":
      return "AI recipe assistance isn't configured yet.";
    case "timeout":
    case "network":
      return "The AI assistant took too long to respond. Try again or keep your current draft.";
    case "rate_limited":
      return "The AI assistant is busy right now. Try again in a moment.";
    case "upstream_error":
    default:
      return "The AI assistant is temporarily unavailable.";
  }
}
