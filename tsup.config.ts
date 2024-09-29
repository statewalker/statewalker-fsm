import { defineConfig, type Options } from "tsup";

export default defineConfig((options: Options) => ({
  entryPoints: ["src/index.ts", "src/context/index.ts"],
  clean: true,
  dts: true,
  noExternal: [],
  format: ["esm"],
  ...options,
}));
