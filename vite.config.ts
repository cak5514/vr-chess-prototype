import { defineConfig } from "vitest/config";

export default defineConfig({
  // A relative base makes the built site work from any folder, such as
  // https://<user>.github.io/<repository>/ on GitHub Pages, without having
  // to write the repository name here.
  base: "./",
  test: {
    // core/ has no DOM, so tests run in plain Node.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
