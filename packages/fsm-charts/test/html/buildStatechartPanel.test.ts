import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { process } from "../data/process.checkout.js";
import { describe, it } from "../deps.js";
import { expectControlFile } from "./expectControlFile.js";

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
    await expectControlFile(controlFileName, result);
  });
});
