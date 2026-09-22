import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": here },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
    // supabaseEnv() (tests/helpers.ts) shells out to `npx supabase status`,
    // which blocks the event loop for ~8s on this machine (npx cold start +
    // the CLI stopping unused optional services as a side effect of
    // checking status). That alone exceeds Vitest's 5s default, and real
    // round-trips (email confirmation via Mailpit) add more on top.
    testTimeout: 30_000,
  },
});
