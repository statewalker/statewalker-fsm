import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  // `@statewalker/fsm` and `@statewalker/fsm-charts` are `dependencies`, so tsdown
  // keeps them external: the `.d.ts` imports their types (a consumer's `FsmProcess` is
  // the same class) and the bundle does not carry a second copy.
  // Emit `.js`/`.d.ts` (not `.mjs`/`.d.mts`) to match `package.json` exports.
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  target: "es2020",
  treeshake: true,
});
