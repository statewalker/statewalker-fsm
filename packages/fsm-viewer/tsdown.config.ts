import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  // Bundled into the viewer, as before with tsup.
  deps: { alwaysBundle: ["@statewalker/fsm", "@statewalker/fsm-charts"] },
  // Emit `.js`/`.d.ts` (not `.mjs`/`.d.mts`) to match `package.json` exports.
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  target: "es2020",
  treeshake: true,
});
