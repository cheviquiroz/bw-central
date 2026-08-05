import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
    // Same reasoning as ifc-headless/vitest.config.ts: real fixtures
    // (parsed via @bw-central/ifc-headless) take longer than vitest's
    // default timeout.
    testTimeout: 30_000,
  },
});
