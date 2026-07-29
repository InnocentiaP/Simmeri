// Small, shared helpers for safely displaying a user-owned URL (e.g. a
// recipe's import source) without rendering untrusted content as a link.

export function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// The exact guard a "Source" section should use before rendering a link:
// only for a non-empty value that is actually a safe http(s) URL.
export function shouldShowSourceLink(url: string | null | undefined): boolean {
  return Boolean(url) && isSafeHttpUrl(url as string);
}
