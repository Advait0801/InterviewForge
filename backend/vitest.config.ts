import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Unit tests only: no network, no database, no API keys.
    testTimeout: 10_000,
    // auth.ts refuses a missing or short signing secret, so tests get a valid one.
    env: { JWT_SECRET: "test-secret-that-is-at-least-32-characters-long" },
  },
});
