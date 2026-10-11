import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Layer rule 1: core/ must not know about the browser page, Three.js,
  // or any layer above it.
  {
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["three", "three/*"],
              message: "core/ must not use Three.js.",
            },
            {
              group: ["**/ui/**", "**/modes/**", "**/platform/**"],
              message: "core/ must not import from ui/, modes/ or platform/.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "core/ must not touch the DOM." },
        { name: "document", message: "core/ must not touch the DOM." },
        { name: "localStorage", message: "Use the storage interface in core/progress." },
      ],
    },
  },

  // Layer rule 2: everything above core/ goes through core/index.ts only.
  {
    files: ["src/ui/**/*.ts", "src/modes/**/*.ts", "src/platform/**/*.ts", "src/main.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/core/*", "!**/core/index"],
              message: "Import from core/index.ts, not from inside core/.",
            },
          ],
        },
      ],
    },
  },
);
