import { FsmProcess, type FsmStateConfig } from "@statewalker/fsm";
import { _addStateRenderer } from "../src/_addStateRenderer.js";
import { describe, expect, it } from "./deps.js";

// #11 relies on _addStateRenderer returning a working disposer that renderStateCharts
// then wires to `invalidation`. Lock that the disposer actually detaches the
// onStateCreate subscription so later states no longer invoke the renderer.
describe("_addStateRenderer disposer (adversarial-review #11)", () => {
  it("stops rendering states created after the disposer is called", async () => {
    const config: FsmStateConfig = {
      key: "App",
      transitions: [
        ["", "*", "A"],
        ["A", "go", "B"],
      ],
    };
    const p = new FsmProcess(config);
    const rendered: string[] = [];
    const dispose = _addStateRenderer(p, (stack) => {
      rendered.push(stack.join(">"));
    });
    await p.dispatch(""); // App, A rendered
    const before = rendered.length;
    dispose();
    await p.dispatch("go"); // B is created AFTER dispose — must not render
    expect(rendered.length).toBe(before);
  });
});
