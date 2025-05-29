import { describe, it, expect } from "./deps.js";
import { newFsmProcess } from "../src/index.js";
import type { FsmStateConfig } from "../src/index.js";

describe("newFsmProcess", () => {
  it("should return 'dispatch' method allowing to run process", async () => {
    const config = {
      key: "Selection",
      transitions: [
        ["*", "exit", ""],
        ["*", "*", "Wait"],
        ["Wait", "select", "Selected"],
        ["*", "error", "HandleError"],
        ["HandleError", "*", "Wait"],
      ],
      states: [
        {
          key: "Selected",
          transitions: [
            ["", "*", "Wait"],
            ["Wait", "select", "UpdateSelection"],
            ["UpdateSelection", "error", ""],
            ["UpdateSelection", "select", "Wait"],
          ],
        },
      ],
    } as FsmStateConfig;
    const stack: string[] = [];
    const traces: string[] = [];
    const context = {};
    const [dispatch] = newFsmProcess(context, config, (state, event) => {
      return () => {
        let prefix = stack.map(() => "  ").join("");
        stack.push(state);
        traces.push(`${prefix}<${state} event="${event}">`);
        return () => {
          traces.push(`${prefix}</${state}>`);
          stack.pop();
        };
      };
    });

    expect(stack).toEqual([]);
    expect(traces).toEqual([]);
    await dispatch("start");
    expect(stack).toEqual(["Selection", "Wait"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "Wait"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      '  </Wait>',
      '  <Selected event="select">',
      '    <Wait event="select">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "UpdateSelection"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      '  </Wait>',
      '  <Selected event="select">',
      '    <Wait event="select">',
      '    </Wait>',
      '    <UpdateSelection event="select">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "Wait"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      '  </Wait>',
      '  <Selected event="select">',
      '    <Wait event="select">',
      '    </Wait>',
      '    <UpdateSelection event="select">',
      '    </UpdateSelection>',
      '    <Wait event="select">',
    ]);

    await dispatch("error");
    expect(stack).toEqual(["Selection", "HandleError"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      '  </Wait>',
      '  <Selected event="select">',
      '    <Wait event="select">',
      '    </Wait>',
      '    <UpdateSelection event="select">',
      '    </UpdateSelection>',
      '    <Wait event="select">',
      '    </Wait>',
      '  </Selected>',
      '  <HandleError event="error">',
    ]);
  });
});
