import { describe, it, expect } from "./deps.js";
import { startFsmProcess } from "../src/startFsmProcess.js";
import type { FsmStateConfig } from "../src/FsmStateConfig.js";

describe("startFsmProcess", () => {

  it("should dispatch events with AsyncGenerators", async () => {
    // See https://github.com/observablehq/framework/blob/5745573b5ccaff92e837d692e9c559993f684d28/src/client/stdlib/generators/observe.js
    async function* observe<T>(
      initialize: (
        next: (value: T) => void,
      ) => (() => void | Promise<void>) | void,
    ): AsyncGenerator<T, void, unknown> {
      let resolve: ((value: T) => void) | null = null;

      let value: T = null!;
      let stale = false;

      const dispose = initialize((x) => {
        value = x;
        if (resolve) resolve(x), (resolve = null);
        else stale = true;
        return x;
      });

      try {
        while (true) {
          if (stale) {
            stale = false;
            yield value as T;
          } else yield new Promise<T>((_) => (resolve = _));
        }
      } finally {
        await dispose?.();
      }
    }

    function newListener<T extends unknown[] = [unknown]>(): [
      addListener: (
        listener: (...args: T) => void | Promise<void>,
      ) => () => void,
      notifyListeners: (...args: T) => Promise<void>,
    ] {
      const index: Record<number, (...args: T) => void | Promise<void>> = {};
      let nextIndex = 0;
      function addListener(
        listener: (...args: T) => void | Promise<void>,
      ): () => void {
        const indexKey = nextIndex++;
        index[indexKey] = listener;
        return () => {
          delete index[indexKey];
        };
      }
      async function notify(...args: T): Promise<void> {
        for (const key in index) {
          await index[key]?.(...args);
        }
      }
      return [addListener, notify];
    }
    function newRegistry() {
      const index: Record<number, () => void | Promise<void>> = {};
      let nextIndex = 0;
      return [
        (listener: () => void | Promise<void>) => {
          const indexKey = nextIndex++;
          index[indexKey] = listener;
          return () => {
            delete index[indexKey];
          };
        },
        () => {
          for (const key in index) {
            index[key]?.();
          }
        },
      ];
    }

    function newObserver<T = unknown>(): [
      observe: () => AsyncGenerator<T, void, unknown>,
      notify: (value: T) => Promise<void>,
    ] {
      const [addListener, notifyListeners] = newListener<[T]>();
      async function* observeValue() {
        yield* observe<T>(addListener);
      }
      async function notify(value: T): Promise<void> {
        await notifyListeners(value);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      return [observeValue, notify];
    }

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
    const [eventsTrigger, dispatch] = newObserver<string>();
    const stack: string[] = [];
    const traces: string[] = [];
    const context = {};

    const shutdown = startFsmProcess(
      context,
      config,
      (state, event) => {
        const trackState = () => {
          let prefix = stack.map(() => "  ").join("");
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

    await new Promise((resolve) => setTimeout(resolve, 0));
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
      "  </Selected>",
      '  <HandleError event="error">',
    ]);
  });
});
