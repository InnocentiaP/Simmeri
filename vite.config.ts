// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Pin the Nitro build target to Vercel. The wrapper's Cloudflare default is only
// force-applied inside Lovable's own sandbox, so this override is safe everywhere else.
//
// `vercel.functions.maxDuration`: AI calls (URL fallback, screenshots, and
// especially video) can take 20–50 s. 60 s is allowed on every Vercel plan;
// without it, older projects default to 10 s. Keep the timeouts in
// src/lib/import/gemini-client.server.ts below this. Nitro passes the option
// through to .vc-config.json, but the wrapper's type only lists a few nitro
// keys — declaring the object separately avoids a false excess-property error.
const nitro = {
  preset: "vercel",
  vercel: { functions: { maxDuration: 60 } },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  nitro,
});
