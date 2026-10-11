import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // core/ has no DOM, so tests run in plain Node.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
