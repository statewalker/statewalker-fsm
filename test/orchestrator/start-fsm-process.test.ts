import type { FsmStateConfig } from "../../src/core/fsm-state-config.js";
import { startFsmProcess } from "../../src/orchestrator/start-process.js";
import { describe, expect, it } from "../deps.js";
import { newAsyncGenerator } from "./new-async-generator.js";

describe("startFsmProcess", () => {
  it("should dispatch events with AsyncGenerators", async () => {
    const config = {
      key: "Selection",
      transitions: [
        ["*", "exit", ""],
        ["*", "*", "Wait"],
        ["Wait", "select", "Selected"],
        ["*", "error", "HandleError"],
        ["HandleError", "ok", "Wait"],
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

    let dispatch: (event: string) => Promise<unknown> = async () => {};
    async function* eventsTrigger() {
      yield* newAsyncGenerator<string>((next) => {
        dispatch = next;
      });
    }
    // const [eventsTrigger, dispatch] = newObservable<string>();

    const stack: string[] = [];
    const traces: string[] = [];
    const context = {};

    const shutdown = await startFsmProcess(
      context,
      config,
      (state, event) => {
        const trackState = () => {
          const prefix = stack.map(() => "  ").join("");
          stack.push(state);
          traces.push(`${prefix}<${state} event="${event}">`);
          return () => {
            traces.push(`${prefix}</${state}>`);
            stack.pop();
          };
        };
        return state === "Selection"
          ? [eventsTrigger, trackState]
          : [trackState];
      },
      "start", // initial event
    );
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
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "UpdateSelection"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "Wait"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      '    <Wait event="select">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "UpdateSelection"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
    ]);

    await dispatch("error");
    expect(stack).toEqual(["Selection", "HandleError"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      "  </Selected>",
      '  <HandleError event="error">',
    ]);

    await dispatch("ok");
    expect(stack).toEqual(["Selection", "Wait"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      "  </Selected>",
      '  <HandleError event="error">',
      "  </HandleError>",
      '  <Wait event="ok">',
    ]);

    await shutdown();
    expect(stack).toEqual([]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      "  </Selected>",
      '  <HandleError event="error">',
      "  </HandleError>",
      '  <Wait event="ok">',
      "  </Wait>",
      "</Selection>",
    ]);
  });
});
