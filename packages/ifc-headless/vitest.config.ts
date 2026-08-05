import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
    // Los fixtures reales (CASA-MEP.ifc en particular, ~400MB) tardan más
    // que el timeout por defecto de vitest en parsear + derivar geometría.
    testTimeout: 30_000,
  },
});
