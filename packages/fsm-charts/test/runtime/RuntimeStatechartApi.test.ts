import { JSDOM } from "jsdom";
import { buildStatechartCss } from "../../src/index-html.js";
import {
  RuntimeStatechartApi,
  StateChartIndex,
} from "../../src/index-runtime.js";
import { process } from "../data/process.checkout.js";
import { describe, expect, it } from "../deps.js";
import { toStatechartsPanels } from "../html/toStatechartsPanels.js";

describe("RuntimeStatechartApi", () => {
  it("should generate transitions graph", async () => {
    const { html, statechart } = toStatechartsPanels(process);
    const css = buildStatechartCss({ prefix: "" });
    const document = new JSDOM(`<body>
${html}
${css}
</body>`).window.document;
    const element = document.querySelector("details") as HTMLElement;
    const api = new RuntimeStatechartApi({
      element,
      statechart,
    });
    const index = new StateChartIndex({ statechart });
    const stateKeys = ["App", "OpenFileSystem", "ChooseFolder", "A"];
    const stateIds = index.getStatesIds(...stateKeys);
    const stateId = stateIds[stateIds.length - 1];
    api.selectState(stateId);
    expect(api.isStateSelected(stateId)).toBe(true);
  });

  it("should generate transitions graph", async () => {
    const { html } = toStatechartsPanels(process);
    const css = buildStatechartCss({ prefix: "" });
    const document = new JSDOM(`<body>
${html}
${css}
</body>`).window.document;
    const stateDetailsLabels = [
      ...document.querySelectorAll("details > summary"),
    ].map((elm) => elm.textContent);
    expect(stateDetailsLabels).toEqual([
      "App",
      "Open File System",
      "Choose Folder",
      "Show Error",
    ]);

    const stateChartLabels = [
      ...document.querySelectorAll("g.state > .state__label"),
    ].map((elm) => elm.textContent);
    expect(stateChartLabels).toEqual([
      "Open File System",
      "Show Error",
      "Choose Folder",
      "Check Folder Access",
      "A",
      "B",
      "C",
      "Show Message",
      "Show Detailed Message",
    ]);
  });
});
