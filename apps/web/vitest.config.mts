import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// .mts so Vite loads this as ESM natively rather than warning about ESM
// syntax in a CommonJS-loaded file.
export default defineConfig({
  plugins: [react()],
  // Native replacement for vite-tsconfig-paths; resolves the "@/*" alias
  // straight from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Unit/component only. Playwright owns tests/e2e and must not be picked
    // up here — its test/expect come from a different runner.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
  },
});
