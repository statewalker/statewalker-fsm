import fs from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { process } from "../data/process.checkout.js";
import { describe, expect, it } from "../deps.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { buildStatechartCss } from "../../src/html/index.js";
import { toStatechartsPanels } from "./toStatechartsPanels.js";

// buildStatechartsPanel
describe("buildStatechartsPanel", () => {
  it("should generate transitions graph", async () => {
    const controlFileName = join(
      __dirname,
      "./buildStatechartPanel.control.html",
    );

    let control = "";
    try {
      control = await fs.readFile(controlFileName, "utf-8");
    } catch (_error) {
      control = "";
    }

    const { html } = toStatechartsPanels(process);
    const prefix = ".main";
    const css = buildStatechartCss({ prefix });
    const result = `
<!DOCTYPE html>
<html>
<head>
</head>
<body>
<div class="main" style="max-width: 500px;">
<style>
${css}
</style>
${html}
</div>
</body>
</html>`;
    try {
      expect(result).toEqual(control);
    } catch (error) {
      await fs.writeFile(controlFileName, result, "utf-8");
      throw error;
    }
  });
});
