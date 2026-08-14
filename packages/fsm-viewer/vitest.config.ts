import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["**/tmp/*"],
    // ... Specify options here.
  },
});
