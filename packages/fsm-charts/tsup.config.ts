import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => ({
  entryPoints: [
    "src/index.ts",
    "src/index-dom.ts",
    "src/index-config.ts",
    "src/index-layout.ts",
    "src/index-html.ts",
    "src/index-runtime.ts",
  ],
  clean: true,
  dts: true,
  treeshake: true,
  noExternal: [],
  format: ["esm"],
  ...options,
  esbuildOptions(options, _context) {
    options.target = "es2020";
  },
}));
