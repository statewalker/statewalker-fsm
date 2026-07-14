// @vitest-environment jsdom
import { FsmProcess, type FsmStateConfig } from "@statewalker/fsm";
import { renderStateDescription } from "../src/renderStateDescription.js";
import { describe, expect, it } from "./deps.js";

// A renderer that returns a DocumentFragment (exactly what prepareStateDescriptions
// returns) carrying "desc:<leaf> " for the current stack's leaf state.
function renderer(stack: string[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  const span = document.createElement("span");
  span.textContent = `desc:${stack[stack.length - 1]} `;
  frag.appendChild(span);
  return frag;
}

describe("renderStateDescription (adversarial-review #5)", () => {
  it("removes a state's DocumentFragment description on exit", async () => {
    const config: FsmStateConfig = {
      key: "App",
      transitions: [
        ["", "*", "A"],
        ["A", "go", "B"],
      ],
    };
    const p = new FsmProcess(config);
    const div = renderStateDescription({ process: p, renderer });
    await p.dispatch(""); // App -> A
    await p.dispatch("go"); // A -> B  (A's description must be removed)
    expect(div.textContent).toBe("desc:App desc:B ");
  });
});
