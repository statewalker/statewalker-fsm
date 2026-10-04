import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: [
    "src/index.ts",
    "src/index-dom.ts",
    "src/index-config.ts",
    "src/index-layout.ts",
    "src/index-html.ts",
    "src/index-runtime.ts",
  ],
  format: ["esm"],
  // Emit `.js`/`.d.ts` (not `.mjs`/`.d.mts`) to match `package.json` exports.
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  target: "es2020",
  treeshake: true,
});
