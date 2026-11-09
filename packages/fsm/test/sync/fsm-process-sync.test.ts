import {
  FsmProcess,
  FsmProcessSync,
  type FsmStateConfig,
  type FsmStateSync,
  getStateTransitions,
  isStateTransitionEnabled,
  STATUS_FINISHED,
  STATUS_LEAF,
  STATUS_NONE,
  setProcessTracer,
} from "../../src/index.ts";
import { describe, expect, it } from "../deps.ts";
import coffeeMachine from "../process.CofeeMachine.ts";
import productCatalog from "../process.ProductCatalog.ts";

const linear: FsmStateConfig = {
  key: "Root",
  transitions: [
    ["", "*", "A"],
    ["A", "next", "B"],
    ["B", "next", "C"],
    ["C", "*", ""],
  ],
};

/** Run `events` through a sync machine; return its enter/exit trace + leaf paths. */
function traceSync(config: FsmStateConfig, events: string[]) {
  const trace: string[] = [];
  const p = new FsmProcessSync(config);
  p.onStateCreate((s) => {
    s.onEnter(() => trace.push(`<${s.key} ${p.event}>`));
    s.onExit(() => trace.push(`</${s.key} ${p.event}>`));
  });
  const paths: string[] = [];
  for (const event of events) {
    p.dispatch(event);
    paths.push(pathOf(p.state));
  }
  return { trace, paths, status: p.status };
}

/** The same, for the async engine — the reference behaviour. */
async function traceAsync(config: FsmStateConfig, events: string[]) {
  const trace: string[] = [];
  const p = new FsmProcess(config);
  p.onStateCreate((s) => {
    s.onEnter(() => {
      trace.push(`<${s.key} ${p.event}>`);
    });
    s.onExit(() => {
      trace.push(`</${s.key} ${p.event}>`);
    });
  });
  const paths: string[] = [];
  for (const event of events) {
    await p.dispatch(event);
    paths.push(pathOf(p.state));
  }
  return { trace, paths, status: p.status };
}

function pathOf(state?: { key: string; parent?: { key: string; parent?: unknown } }) {
  const keys: string[] = [];
  for (let s = state as { key: string; parent?: unknown } | undefined; s; ) {
    keys.unshift(s.key);
    s = s.parent as typeof s;
  }
  return keys.join("/");
}

describe("FsmProcessSync", () => {
  describe("basics", () => {
    it("starts idle", () => {
      const p = new FsmProcessSync(linear);
      expect(p.status).toBe(STATUS_NONE);
      expect(p.state).toBeUndefined();
      expect(p.mask).toBe(STATUS_LEAF);
    });

    it("dispatch is synchronous and returns a boolean, not a promise", () => {
      const p = new FsmProcessSync(linear);
      const result = p.dispatch("");
      expect(result).toBe(true);
      expect(p.state?.key).toBe("A");
      expect(p.status).toBe(STATUS_LEAF);
    });

    it("walks a linear machine to the end", () => {
      const p = new FsmProcessSync(linear);
      p.dispatch("");
      expect(p.dispatch("next")).toBe(true);
      expect(p.state?.key).toBe("B");
      expect(p.dispatch("next")).toBe(true);
      expect(p.state?.key).toBe("C");
      expect(p.dispatch("anything")).toBe(false);
      expect(p.status).toBe(STATUS_FINISHED);
      expect(p.state).toBeUndefined();
    });

    it("ignores events once finished", () => {
      const p = new FsmProcessSync(linear);
      p.dispatch("");
      p.shutdown();
      expect(p.dispatch("next")).toBe(false);
      expect(p.nextEvents).toEqual([]);
    });

    it("methods are bound and can be passed as callbacks", () => {
      const p = new FsmProcessSync(linear);
      const { dispatch, shutdown } = p;
      dispatch("");
      expect(p.state?.key).toBe("A");
      shutdown();
      expect(p.state).toBeUndefined();
    });
  });

  describe("parity with the async FsmProcess", () => {
    const scenarios: [string, FsmStateConfig, string[]][] = [
      ["linear", linear, ["", "next", "next", "end"]],
      [
        "coffee machine",
        coffeeMachine,
        ["", "touch", "timeout", "touch", "select", "ok", "done", "done", "taken", "switch"],
      ],
      [
        "coffee machine with error path",
        coffeeMachine,
        ["", "touch", "select", "error", "acknowledge", "touch", "select", "ok", "switch"],
      ],
      [
        "product catalog",
        productCatalog,
        ["", "showDetails", "back", "showBasket", "showDetails", "addToBasket", "ok", "back"],
      ],
      ["unknown event unwinds the whole machine", productCatalog, ["", "nonsense"]],
    ];
    for (const [name, config, events] of scenarios) {
      it(name, async () => {
        const expected = await traceAsync(config, events);
        expect(traceSync(config, events)).toEqual(expected);
      });
    }
  });

  describe("re-entrant dispatch", () => {
    it("queues events dispatched from handlers and applies them in order", () => {
      const p = new FsmProcessSync(linear);
      const entered: string[] = [];
      p.onStateCreate((s) => {
        s.onEnter(() => {
          entered.push(s.key);
          if (s.key === "A") {
            // Both are queued while the first dispatch is still running.
            expect(p.dispatch("next")).toBe(true);
            p.dispatch("next");
          }
        });
      });
      p.dispatch("");
      expect(entered).toEqual(["Root", "A", "B", "C"]);
      expect(p.state?.key).toBe("C");
      expect(p.running).toBe(false);
    });
  });

  describe("shutdown", () => {
    it("exits states inner-to-outer with the given event", () => {
      const p = new FsmProcessSync(coffeeMachine);
      const exits: string[] = [];
      p.onStateCreate((s) => s.onExit(() => exits.push(`${s.key}:${p.event}`)));
      p.dispatch("");
      p.shutdown("power-off");
      expect(exits).toEqual([
        "DisplayWelcomeScreen:power-off",
        "WaitForSelection:power-off",
        "CoffeeMachine:power-off",
      ]);
      expect(p.status).toBe(STATUS_FINISHED);
    });

    it("a shutdown requested from an onExit handler does not exit states twice", () => {
      const p = new FsmProcessSync(linear);
      const exits: string[] = [];
      p.onStateCreate((s) =>
        s.onExit(() => {
          exits.push(s.key);
          p.shutdown();
        }),
      );
      p.dispatch("");
      p.shutdown();
      expect(exits).toEqual(["A", "Root"]);
    });

    it("a shutdown from onEnter stops the running dispatch", () => {
      const p = new FsmProcessSync(linear);
      const log: string[] = [];
      p.onStateCreate((s) => {
        s.onEnter(() => {
          log.push(`+${s.key}`);
          if (s.key === "B") p.shutdown();
        });
        s.onExit(() => log.push(`-${s.key}`));
      });
      p.dispatch("");
      expect(p.dispatch("next")).toBe(false);
      expect(log).toEqual(["+Root", "+A", "-A", "+B", "-B", "-Root"]);
    });
  });

  describe("errors", () => {
    it("routes a throwing handler to state and process onStateError and keeps going", () => {
      const p = new FsmProcessSync(linear);
      const errors: string[] = [];
      const origError = console.error;
      console.error = () => {};
      try {
        p.onStateError((s, e) => errors.push(`process:${s.key}:${(e as Error).message}`));
        p.onStateCreate((s) => {
          s.onStateError((st, e) => errors.push(`state:${st.key}:${(e as Error).message}`));
          if (s.key === "A") {
            s.onEnter(() => {
              throw new Error("boom");
            });
          }
        });
        p.dispatch("");
      } finally {
        console.error = origError;
      }
      expect(errors).toEqual(["state:A:boom", "process:A:boom"]);
      expect(p.state?.key).toBe("A");
    });

    it("reports an async (promise-returning) handler as a TypeError", () => {
      const p = new FsmProcessSync(linear);
      const errors: unknown[] = [];
      const origError = console.error;
      console.error = () => {};
      try {
        p.onStateCreate((s) => {
          s.onStateError((_, e) => errors.push(e));
          if (s.key === "A") {
            // Deliberately misusing the sync engine with an async handler.
            (s.onEnter as (h: () => unknown) => void)(async () => {});
          }
        });
        p.dispatch("");
      } finally {
        console.error = origError;
      }
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(TypeError);
    });

    it("does not recurse when an onStateError handler throws", () => {
      const p = new FsmProcessSync(linear);
      let calls = 0;
      const origError = console.error;
      console.error = () => {};
      try {
        p.onStateCreate((s) => {
          s.onStateError(() => {
            calls++;
            throw new Error("error-in-error-handler");
          });
          s.onEnter(() => {
            throw new Error("enter");
          });
        });
        p.dispatch("");
      } finally {
        console.error = origError;
      }
      expect(calls).toBe(2); // once for Root, once for A
    });
  });

  describe("dump / restore", () => {
    function withCounter(p: FsmProcessSync) {
      p.onStateCreate((s: FsmStateSync) => {
        let visits = 0;
        s.onEnter(() => visits++);
        s.dump((_, data) => {
          (data as Record<string, unknown>).visits = visits;
        });
        s.restore((_, data) => {
          visits = (data as Record<string, unknown>).visits as number;
        });
      });
      return p;
    }

    it("round-trips the stack and per-state data", () => {
      const p1 = withCounter(new FsmProcessSync(coffeeMachine));
      p1.dispatch("");
      p1.dispatch("touch");
      const dump = p1.dump();
      expect(dump.stack.map((s) => s.key)).toEqual([
        "CoffeeMachine",
        "WaitForSelection",
        "DisplayOptions",
      ]);
      expect(dump.event).toBe("touch");

      const p2 = withCounter(new FsmProcessSync(coffeeMachine));
      p2.restore(dump);
      expect(p2.dump()).toEqual(dump);
      p2.dispatch("select");
      expect(pathOf(p2.state)).toBe("CoffeeMachine/CheckAvailability");
    });

    it("dumps are interchangeable with the async engine", async () => {
      const sync = new FsmProcessSync(productCatalog);
      sync.dispatch("");
      sync.dispatch("showBasket");
      const dump = sync.dump();

      const async = new FsmProcess(productCatalog);
      await async.restore(JSON.parse(JSON.stringify(dump)));
      expect(await async.dump()).toEqual(dump);
      await async.dispatch("showDetails");

      const back = new FsmProcessSync(productCatalog);
      back.restore(await async.dump());
      expect(pathOf(back.state)).toBe("App/ProductBasket/ProductView");
    });

    it("restore resumes a finished machine from a live snapshot", () => {
      const p = new FsmProcessSync(linear);
      p.dispatch("");
      const dump = p.dump();
      p.shutdown();
      p.restore(dump);
      expect(p.dispatch("next")).toBe(true);
      expect(p.state?.key).toBe("B");
    });
  });

  describe("integration with introspection and tracing", () => {
    it("getStateTransitions / isStateTransitionEnabled accept a sync process", () => {
      const p = new FsmProcessSync(coffeeMachine);
      p.dispatch("");
      p.dispatch("touch");
      expect(isStateTransitionEnabled(p, "select")).toBe(true);
      expect(isStateTransitionEnabled(p, "ok")).toBe(false);
      expect(getStateTransitions(p.state).map(([, e]) => e)).toContain("switch");
    });

    it("setProcessTracer prints synchronously", () => {
      const p = new FsmProcessSync(linear);
      const lines: string[] = [];
      setProcessTracer(p, (...args: unknown[]) => lines.push(args.join("")));
      p.dispatch("");
      p.dispatch("next");
      expect(lines).toEqual([
        '<Root event="">',
        '<A event="">',
        '</A> <!-- event="next" -->',
        '<B event="next">',
      ]);
    });
  });
});
