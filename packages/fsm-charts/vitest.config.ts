import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/tmp/*"],
    // These tests build a real JSDOM document and lay out a statechart graph; the SVG test
    // alone takes ~1.6s on an idle machine. vitest's 5s default is not a budget for that
    // kind of work once `turbo run build` is compiling fourteen repositories alongside it,
    // and `build` here is `pnpm test && tsup` -- so a timeout does not fail one test, it
    // fails the build, and every package downstream of it in the task graph.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
