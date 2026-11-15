import { JSDOM } from "jsdom";
import { RuntimeStatechartApi } from "../../src/index-runtime.js";
import type { FsmStateConfig } from "../../src/types/index.js";
import { describe, expect, it } from "../deps.js";
import { toStatechartsPanels } from "../html/toStatechartsPanels.js";

// Regression for #31: the state click listener swallowed every click inside a state's
// description panel (links did not navigate, checkboxes did not toggle).
const config: FsmStateConfig = {
  key: "App",
  transitions: [
    ["", "*", "Main"],
    ["Main", "exit", ""],
  ],
  states: [{ key: "Main", transitions: [["", "*", "Child"]] }],
};

function setup() {
  const { html, statechart } = toStatechartsPanels(config);
  const { window } = new JSDOM(`<body>${html}</body>`);
  const { document } = window;
  const element = document.querySelector("details") as HTMLElement;
  const api = new RuntimeStatechartApi({ element, statechart });
  const clicked: string[] = [];
  api.onStateClick((id) => clicked.push(id));
  return { window, document, element, api, statechart, clicked };
}

describe("RuntimeStatechartApi state clicks (#31)", () => {
  it("lets clicks inside a description through, without firing the state handler", () => {
    const { window, document, api, statechart, clicked } = setup();
    const childId = statechart.children?.[0]?.id ?? "";
    const link = document.createElement("a");
    link.href = "#somewhere";
    link.textContent = "link";
    api.setStateDescription(childId, link);
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    api.setStateDescription(statechart.id, checkbox);

    const linkClick = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    expect(link.dispatchEvent(linkClick)).toBe(true);
    expect(linkClick.defaultPrevented).toBe(false);

    checkbox.click();
    expect(checkbox.checked).toBe(true);
    expect(clicked).toEqual([]);
  }, 30_000);

  it("still fires the state handler for clicks on the summary and on the SVG state", () => {
    const { window, element, statechart, clicked } = setup();
    const childId = statechart.children?.[0]?.id ?? "";
    const summary = element.querySelector(
      `details[data-state-id="${childId}"] > summary`,
    ) as HTMLElement;
    summary.click();
    const label = element.querySelector(`g[data-state-id="${childId}"] text`) as Element;
    label.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(clicked).toEqual([childId, childId]);
  }, 30_000);
});
