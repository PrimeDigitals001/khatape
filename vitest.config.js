import { defineConfig } from "vitest/config";

// Pure-logic test config — intentionally does NOT load the React/Tailwind Vite
// plugins. The domain core (src/lib/*) has no UI or backend imports, so tests run
// fast in a plain Node environment and stay backend-agnostic (Firebase or Supabase).
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.js"],
  },
});
