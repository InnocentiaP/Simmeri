import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const MAX_BYTES = 2 * 1024 * 1024;

// Every failure path collapses to this single message — never leak hostnames,
// IPs, ports, or the specific internal reason to the client.
const GENERIC_FETCH_ERROR =
  "We couldn't reach that page. Double-check the URL and try again.";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return null;
  }
  return (parts[0] * 2 ** 24 + parts[1] * 2 ** 16 + parts[2] * 2 ** 8 + parts[3]) >>> 0;
}

function ipv4InRange(ip: string, base: string, maskBits: number): boolean {
  const n = ipv4ToInt(ip);
  const b = ipv4ToInt(base);
  if (n === null || b === null) return false;
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (n & mask) === (b & mask);
}

function isPrivateIPv4(ip: string): boolean {
  return (
    ipv4InRange(ip, "0.0.0.0", 8) ||
    ipv4InRange(ip, "10.0.0.0", 8) ||
    ipv4InRange(ip, "100.64.0.0", 10) ||
    ipv4InRange(ip, "127.0.0.0", 8) ||
    ipv4InRange(ip, "169.254.0.0", 16) ||
    ipv4InRange(ip, "172.16.0.0", 12) ||
    ipv4InRange(ip, "192.0.0.0", 24) ||
    ipv4InRange(ip, "192.0.2.0", 24) ||
    ipv4InRange(ip, "192.168.0.0", 16) ||
    ipv4InRange(ip, "198.18.0.0", 15) ||
    ipv4InRange(ip, "198.51.100.0", 24) ||
    ipv4InRange(ip, "203.0.113.0", 24) ||
    ipv4InRange(ip, "224.0.0.0", 4) ||
    ipv4InRange(ip, "240.0.0.0", 4)
  );
}

// Minimal RFC 4291-aware IPv6 parser (no dependency): expands "::" and any
// embedded IPv4 tail, returns 16 bytes, or null if unparseable (fail closed).
function parseIPv6ToBytes(address: string): number[] | null {
  const addr = address.split("%")[0];
  const dc = addr.indexOf("::");
  const head = dc !== -1 ? addr.slice(0, dc) : addr;
  const tail = dc !== -1 ? addr.slice(dc + 2) : "";

  const expandV4 = (parts: string[]): string[] => {
    if (parts.length === 0) return parts;
    const last = parts[parts.length - 1];
    if (!last.includes(".")) return parts;
    const v4 = ipv4ToInt(last);
    if (v4 === null) return parts;
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    return [...parts.slice(0, -1), hi, lo];
  };

  const headParts = expandV4(head.length ? head.split(":") : []);
  const tailParts = expandV4(tail.length ? tail.split(":") : []);

  let groups: string[];
  if (dc !== -1) {
    const missing = 8 - (headParts.length + tailParts.length);
    if (missing < 0) return null;
    groups = [...headParts, ...Array(missing).fill("0"), ...tailParts];
  } else {
    groups = headParts;
  }
  if (groups.length !== 8) return null;

  const bytes: number[] = [];
  for (const g of groups) {
    const v = parseInt(g === "" ? "0" : g, 16);
    if (Number.isNaN(v) || v < 0 || v > 0xffff) return null;
    bytes.push((v >> 8) & 0xff, v & 0xff);
  }
  return bytes;
}

function isPrivateIPv6(ip: string): boolean {
  const bytes = parseIPv6ToBytes(ip);
  if (!bytes) return true; // fail closed on anything unparseable

  const isZero = (arr: number[]) => arr.every((b) => b === 0);

  // Unspecified (::) and loopback (::1)
  if (isZero(bytes.slice(0, 15)) && (bytes[15] === 0 || bytes[15] === 1)) return true;
  // Link-local fe80::/10
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return true;
  // Unique local fc00::/7
  if ((bytes[0] & 0xfe) === 0xfc) return true;
  // Multicast ff00::/8
  if (bytes[0] === 0xff) return true;
  // IPv4-mapped ::ffff:0:0/96 — unwrap and re-check as IPv4
  if (isZero(bytes.slice(0, 10)) && bytes[10] === 0xff && bytes[11] === 0xff) {
    const v4 = `${bytes[12]}.${bytes[13]}.${bytes[14]}.${bytes[15]}`;
    return isPrivateIPv4(v4);
  }
  return false;
}

function isDisallowedAddress(address: string, family: number): boolean {
  return family === 6 ? isPrivateIPv6(address) : isPrivateIPv4(address);
}

const isDev = process.env.NODE_ENV !== "production";

function devLog(...args: unknown[]) {
  // Dev-only diagnostics. Never passed credentials, cookies, auth headers, or
  // env values — only hostnames/addresses being validated, which the caller
  // already supplied as the import target.
  if (isDev) console.error("[recipe-import:url-fetch]", ...args);
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address?: string | dns.LookupAddress[],
  family?: number,
) => void;

// Custom `lookup` passed straight into http(s).request — Node calls this at
// actual connect time, so the address dialed is exactly the one validated
// here, not a stale pre-check. This is what closes the DNS-rebinding gap.
//
// Node's net layer decides the *shape* of the reply it wants via
// `options.all`: when Happy-Eyeballs/autoSelectFamily is in play it asks for
// the array form (`callback(err, addresses[])`); otherwise it wants the
// single-address form (`callback(err, address, family)`). Passing the wrong
// shape back is exactly what caused `ERR_INVALID_IP_ADDRESS: undefined` —
// Node tried to read `.address`/`.family` off whatever we handed it. This
// adapter resolves + validates once, then replies in whichever shape was
// actually requested. `fetchOneHop` additionally sets `autoSelectFamily:
// false` so the single-address form is the path exercised in practice; the
// array-form branch remains as a correctness fallback, not the primary path.
function safeLookup(
  hostname: string,
  options: { all?: boolean } | LookupCallback,
  callback?: LookupCallback,
) {
  // node:net always calls with (hostname, options, callback) for a function
  // passed as the `lookup` request option, but guard the 2-arg form too since
  // it's part of the documented dns.lookup-compatible contract.
  const cb: LookupCallback = typeof options === "function" ? options : callback!;
  const wantsAll = typeof options === "object" && options !== null && options.all === true;

  dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => {
    if (err) {
      devLog("DNS lookup failed for", hostname, err.message);
      return cb(err);
    }
    if (!addresses || addresses.length === 0) {
      return cb(new Error("DNS resolution returned no addresses") as NodeJS.ErrnoException);
    }

    const blocked = addresses.find((a) => isDisallowedAddress(a.address, a.family));
    if (blocked) {
      devLog("Blocked disallowed resolved address for", hostname, blocked.address);
      return cb(
        new Error("Blocked: target resolves to a disallowed network address") as NodeJS.ErrnoException,
      );
    }

    if (wantsAll) {
      cb(null, addresses);
      return;
    }

    // Deterministic single-address selection: first entry, matching the
    // order Node's own resolver returned (already fully validated above).
    const selected = addresses[0];
    cb(null, selected.address, selected.family);
  });
}

function isAllowedProtocol(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

async function fetchOneHop(url: URL): Promise<{ status: number; contentType: string; body: string; location: string | null }> {
  // Node's net/http stack skips the custom `lookup` entirely when the
  // hostname is already an IP literal (no DNS resolution needed) — so
  // safeLookup's checks never run for URLs like http://192.168.1.1/. This
  // pre-check closes that gap for both IPv4 and bracketed IPv6 literals
  // before any connection is attempted.
  const literalHost = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = net.isIP(literalHost);
  if (literalFamily !== 0 && isDisallowedAddress(literalHost, literalFamily)) {
    devLog("Blocked literal IP hostname", literalHost);
    throw new Error(GENERIC_FETCH_ERROR);
  }

  const lib = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const req = lib.request(
      url,
      {
        method: "GET",
        // @ts-expect-error -- `lookup`/`autoSelectFamily` are valid net.connect/
        // http.request options, just not present in this TS lib's typing.
        lookup: safeLookup,
        // Disable Happy-Eyeballs dual-stack racing: it invokes `lookup` in
        // array-reply mode (see safeLookup above), and this feature has no
        // need for parallel-family racing — one validated address is enough.
        autoSelectFamily: false,
        signal: controller.signal,
        headers: {
          Accept: "text/html",
          "User-Agent": "Simmeri-RecipeImport/1.0",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = res.headers["content-type"] ?? "";
        const location = res.headers.location ?? null;

        if (status >= 300 && status < 400 && location) {
          res.resume();
          clearTimeout(timer);
          resolve({ status, contentType, body: "", location });
          return;
        }

        if (!contentType.toLowerCase().startsWith("text/html")) {
          res.destroy();
          clearTimeout(timer);
          reject(new Error(GENERIC_FETCH_ERROR));
          return;
        }

        if (status < 200 || status >= 300) {
          res.destroy();
          clearTimeout(timer);
          reject(new Error(GENERIC_FETCH_ERROR));
          return;
        }

        let total = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_BYTES) {
            res.destroy();
            clearTimeout(timer);
            reject(new Error(GENERIC_FETCH_ERROR));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          clearTimeout(timer);
          resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf-8"), location: null });
        });
        res.on("error", () => {
          clearTimeout(timer);
          reject(new Error(GENERIC_FETCH_ERROR));
        });
      },
    );

    req.on("error", (err) => {
      clearTimeout(timer);
      devLog("request error for", url.hostname, err.message);
      reject(new Error(GENERIC_FETCH_ERROR));
    });

    req.end();
  });
}

// Fetches a public recipe page HTML with SSRF protections: protocol
// allow-list, DNS-pinned per-hop address validation (rejecting loopback,
// private, link-local incl. cloud metadata, and reserved ranges), a bounded
// manual redirect loop (each hop re-validated), timeout, and a streamed
// response-size cap. Never forwards the caller's cookies/Authorization.
export async function fetchRecipePageHtml(rawUrl: string): Promise<string> {
  let current: URL;
  try {
    current = new URL(rawUrl);
  } catch {
    throw new Error(GENERIC_FETCH_ERROR);
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedProtocol(current)) {
      throw new Error(GENERIC_FETCH_ERROR);
    }

    const result = await fetchOneHop(current);

    if (result.location) {
      if (hop === MAX_REDIRECTS) {
        throw new Error(GENERIC_FETCH_ERROR);
      }
      let next: URL;
      try {
        next = new URL(result.location, current);
      } catch {
        throw new Error(GENERIC_FETCH_ERROR);
      }
      current = next;
      continue;
    }

    return result.body;
  }

  throw new Error(GENERIC_FETCH_ERROR);
}
