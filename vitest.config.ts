import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Colocated tests (lib/foo.test.ts, app/api/**/route.test.ts) count too.
    // A `tests/**` glob silently skips them, which is how a whole suite can sit
    // in the repo looking green while never actually running.
    include: ["**/*.test.ts"],
    // Playwright specs live in e2e/ and are run by `npm run test:e2e`.
    exclude: ["node_modules/**", ".next/**", "e2e/**", "**/__fixtures__/**"],
  },
});
