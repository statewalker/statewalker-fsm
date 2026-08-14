import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => ({
  entryPoints: ["src/index.ts"],
  clean: true,
  dts: true,
  treeshake: true,
  noExternal: [
    "@statewalker/fsm",
    "@statewalker/fsm-charts",
    // "lodash",
  ],
  format: ["esm"],
  ...options,
  esbuildOptions(options, context) {
    options.target = "es2020";
  },
}));
