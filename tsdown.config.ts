import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/bin/node-runner.ts"],
  format: ["esm"],
  // Emit `.js`/`.d.ts` (not `.mjs`/`.d.mts`) to match `package.json` exports,
  // so type-aware consumers resolve `./dist/index.d.ts`.
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  sourcemap: true,
  treeshake: true,
});
