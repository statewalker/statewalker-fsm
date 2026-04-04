import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/bin/node-runner.ts"],
  format: ["esm"],
  sourcemap: true,
  treeshake: true,
});
