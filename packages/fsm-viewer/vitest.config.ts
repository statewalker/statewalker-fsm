import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // `exclude` REPLACES vitest's defaults rather than extending them, so spreading
    // `defaultExclude` is load-bearing: without it `**/node_modules/**` is not excluded,
    // and because `@statewalker/fsm` and `@statewalker/fsm-charts` are pnpm workspace
    // symlinks that expose their `test/` directories, this package collected their 30
    // test files on top of its own 3 -- running the fsm and fsm-charts suites a second
    // time under a config that was never meant for them.
    exclude: [...defaultExclude, "**/tmp/*"],
  },
});
