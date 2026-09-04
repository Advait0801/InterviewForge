import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Unit tests only: no network, no database, no API keys.
    testTimeout: 10_000,
  },
});
