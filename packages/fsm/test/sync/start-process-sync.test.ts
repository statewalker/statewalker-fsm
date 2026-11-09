import {
  type FsmStateConfig,
  KEY_DISPATCH,
  KEY_EVENT,
  KEY_STATES,
  KEY_TERMINATE,
  type StageHandlerSync,
  startProcessSync,
} from "../../src/index.ts";
import { describe, expect, it } from "../deps.ts";

const app: FsmStateConfig = {
  key: "App",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "start", "Working"],
    ["Working", "done", "Result"],
    ["Result", "reset", "Idle"],
    ["*", "quit", ""],
  ],
  states: [
    {
      key: "Working",
      transitions: [
        ["", "*", "Step1"],
        ["Step1", "next", "Step2"],
        ["Step2", "next", ""],
      ],
    },
  ],
};

type Ctx = Record<string, unknown>;
const dispatchOf = (ctx: Ctx) => ctx[KEY_DISPATCH] as (event: string) => void;

describe("startProcessSync", () => {
  it("enters the initial state before returning and binds the context", () => {
    const ctx: Ctx = {};
    const handle = startProcessSync(ctx, app, () => []);
    expect(ctx[KEY_STATES]).toEqual(["App", "Idle"]);
    expect(ctx[KEY_EVENT]).toBe("");
    expect(typeof ctx[KEY_DISPATCH]).toBe("function");
    expect(typeof ctx[KEY_TERMINATE]).toBe("function");
    handle.shutdown();
    expect(ctx[KEY_STATES]).toEqual([]);
  });

  it("calls load on every entry and runs returned cleanups on exit", () => {
    const log: string[] = [];
    const ctx: Ctx = {};
    const handle = startProcessSync(ctx, app, (state, event) => [
      () => {
        log.push(`+${state}(${event})`);
        return () => {
          log.push(`-${state}`);
        };
      },
    ]);
    handle.dispatch("start");
    handle.dispatch("next");
    expect(ctx[KEY_STATES]).toEqual(["App", "Working", "Step2"]);
    handle.dispatch("next"); // Working finishes -> its "" exit resolves to final
    expect(log).toEqual([
      "+App()",
      "+Idle()",
      "-Idle",
      "+Working(start)",
      "+Step1(start)",
      "-Step1",
      "+Step2(next)",
      "-Step2",
      "-Working",
      "-App",
    ]);
  });

  it("the bound dispatch ignores events that trigger no transition", () => {
    const ctx: Ctx = {};
    startProcessSync(ctx, app, () => []);
    dispatchOf(ctx)("bogus"); // would otherwise unwind the whole machine
    expect(ctx[KEY_STATES]).toEqual(["App", "Idle"]);
    dispatchOf(ctx)("start");
    expect(ctx[KEY_STATES]).toEqual(["App", "Working", "Step1"]);
  });

  it("drives a state from a generator, one event per settle", () => {
    const seen: string[] = [];
    const ctx: Ctx = {};
    startProcessSync(ctx, app, (state) => {
      if (state !== "Working") return [];
      return [
        function* (c: Ctx) {
          seen.push((c[KEY_STATES] as string[]).join("/"));
          yield "next";
          seen.push((c[KEY_STATES] as string[]).join("/"));
          yield "next";
          seen.push("unreachable — Working has exited");
        },
      ];
    });
    dispatchOf(ctx)("start");
    // Working: Step1 -> Step2 -> exit to final, which leaves App as well.
    expect(seen).toEqual(["App/Working", "App/Working/Step2"]);
    expect(ctx[KEY_STATES]).toEqual([]);
  });

  it("returns a generator when its state exits", () => {
    let finalized = false;
    const ctx: Ctx = {};
    const handle = startProcessSync(ctx, app, (state) => {
      if (state !== "Idle") return [];
      return [
        function* () {
          try {
            yield "start";
            yield "never-pulled";
          } finally {
            finalized = true;
          }
        },
      ];
    });
    expect(ctx[KEY_STATES]).toEqual(["App", "Working", "Step1"]);
    expect(finalized).toBe(true);
    handle.shutdown();
  });

  it("routes a generator error to the state's error handling", () => {
    const origError = console.error;
    const errors: unknown[] = [];
    console.error = (e: unknown) => errors.push(e);
    try {
      const ctx: Ctx = {};
      startProcessSync(ctx, app, (state) =>
        state === "Idle"
          ? [
              function* () {
                yield* [];
                throw new Error("generator failed");
              },
            ]
          : [],
      );
      expect(ctx[KEY_STATES]).toEqual(["App", "Idle"]);
    } finally {
      console.error = origError;
    }
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe("generator failed");
  });

  it("terminate from a handler shuts the machine down", () => {
    const ctx: Ctx = {};
    startProcessSync(ctx, app, (state) =>
      state === "Result" ? [(c: Ctx) => (c[KEY_TERMINATE] as () => void)()] : [],
    );
    dispatchOf(ctx)("start");
    dispatchOf(ctx)("done");
    expect(ctx[KEY_STATES]).toEqual([]);
    dispatchOf(ctx)("reset"); // finished: ignored
    expect(ctx[KEY_STATES]).toEqual([]);
  });

  it("dump/restore round-trips through the handle", () => {
    const ctx1: Ctx = {};
    const h1 = startProcessSync(ctx1, app, () => []);
    h1.dispatch("start");
    h1.dispatch("next");
    const dump = h1.dump();
    h1.shutdown();

    const cleanups: string[] = [];
    const ctx2: Ctx = {};
    const h2 = startProcessSync(ctx2, app, (state) => [() => () => void cleanups.push(state)]);
    h2.restore(dump);
    // the live "Idle" stack of h2 was unwound before restoring
    expect(cleanups).toEqual(["Idle", "App"]);
    expect(ctx2[KEY_STATES]).toEqual(["App", "Working", "Step2"]);
    expect(ctx2[KEY_EVENT]).toBe("next");
    h2.dispatch("next");
    expect(ctx2[KEY_STATES]).toEqual([]);
  });

  it("accepts a custom start event", () => {
    const events: (string | undefined)[] = [];
    startProcessSync(
      {},
      app,
      (_, event) => {
        events.push(event);
        return [];
      },
      "boot",
    );
    expect(events).toEqual(["boot", "boot"]);
  });

  it("StageHandlerSync is typed against the context", () => {
    type MyCtx = { count: number };
    const inc: StageHandlerSync<MyCtx> = (ctx) => {
      ctx.count++;
    };
    const ctx: MyCtx = { count: 0 };
    startProcessSync(ctx, app, () => [inc]);
    expect(ctx.count).toBe(2); // App + Idle
  });
});
