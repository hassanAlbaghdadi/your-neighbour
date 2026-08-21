import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // false, not the usual true: an empty run is never legitimate here
    // (`npm test` always sweeps the whole repo), so a glob or alias that
    // stops matching should fail loudly rather than report a green run
    // that asserted nothing.
    passWithNoTests: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(
        import.meta.dirname,
        "./vitest.server-only-shim.ts",
      ),
    },
  },
});
