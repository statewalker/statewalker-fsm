import {
  FsmProcess,
  FsmProcessSync,
  type FsmStateConfig,
  getStateTransitions,
  isStateTransitionEnabled,
  KEY_DISPATCH,
  KEY_EVENT,
  KEY_STATES,
  type StageHandlerSync,
  setProcessPrinter,
  setProcessTracer,
  startProcess,
  startProcessSync,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

// Mirrors the snippets of README.md — if a claim there changes, a test here fails.

const config: FsmStateConfig = {
  key: "Player",
  transitions: [
    ["", "", "Idle"],
    ["Idle", "play", "Active"],
    ["*", "stop", "Idle"],
  ],
  states: [
    { key: "Idle" },
    {
      key: "Active",
      transitions: [
        ["", "*", "Playing"],
        ["Playing", "pause", "Paused"],
        ["Paused", "play", "Playing"],
      ],
      states: [{ key: "Playing" }, { key: "Paused" }],
    },
  ],
};

const quietly = async <T>(fn: () => T | Promise<T>): Promise<T> => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};

describe("README §2 — engines", () => {
  it("async FsmProcess", async () => {
    const visits: string[] = [];
    const exits: string[] = [];
    const fsm = new FsmProcess(config);
    fsm.onStateCreate((state) => {
      state.onEnter(async () => {
        await Promise.resolve();
        visits.push(state.key);
      });
      state.onExit(() => {
        exits.push(state.key);
      });
    });
    expect(await fsm.dispatch("")).toBe(true);
    expect(fsm.state?.key).toBe("Idle");
    await fsm.dispatch("play");
    expect(fsm.state?.key).toBe("Playing");
    expect(visits).toEqual(["Player", "Idle", "Active", "Playing"]);
    await fsm.dispatch("stop");
    expect(exits).toEqual(["Idle", "Playing", "Active"]);
    expect(fsm.state?.key).toBe("Idle");
    await fsm.shutdown();
    expect(exits.slice(3)).toEqual(["Idle", "Player"]);
    expect(await fsm.dispatch("play")).toBe(false);
  });

  it("sync FsmProcessSync", () => {
    const fsm = new FsmProcessSync(config);
    expect(fsm.dispatch("")).toBe(true);
    expect(fsm.state?.key).toBe("Idle");
    expect(fsm.dispatch("play")).toBe(true);
    expect(fsm.state?.key).toBe("Playing");
    fsm.dispatch("stop");
    expect(fsm.state?.key).toBe("Idle");
    fsm.shutdown();
    expect(fsm.dispatch("play")).toBe(false);
  });
});

describe("README §3 — runners", () => {
  it("startProcess with an async load, cleanups and guarded dispatch", async () => {
    const log: string[] = [];
    const context: Record<string, unknown> = {};
    const handle = await startProcess(context, config, async (stateKey) => {
      if (stateKey === "Playing") {
        return [
          () => {
            log.push("▶ playing");
            return () => {
              log.push("⏸ left Playing");
            };
          },
        ];
      }
      return [];
    });
    await handle.dispatch("play");
    expect(log).toEqual(["▶ playing"]);
    await handle.dispatch("pause");
    expect(log).toEqual(["▶ playing", "⏸ left Playing"]);
    expect(context[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
    await handle.dispatch("bogus");
    expect(context[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
    expect(context[KEY_EVENT]).toBe("pause");
    await (context[KEY_DISPATCH] as (e: string) => Promise<void>)("stop");
    expect(context[KEY_STATES]).toEqual(["Player", "Idle"]);
    await handle.shutdown();
    expect(context[KEY_STATES]).toEqual([]);
  });

  it("startProcessSync, same shape without await", () => {
    const log: string[] = [];
    const context: Record<string, unknown> = {};
    const handle = startProcessSync(context, config, (stateKey) =>
      stateKey === "Playing" ? [() => () => void log.push("⏸ left Playing")] : [],
    );
    handle.dispatch("play");
    handle.dispatch("pause");
    expect(log).toEqual(["⏸ left Playing"]);
    expect(context[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
    handle.dispatch("bogus");
    expect(context[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
    handle.shutdown();
    expect(context[KEY_STATES]).toEqual([]);
  });
});

describe("README §4 — generators", () => {
  it("async generator: dispatch resolves first, the event arrives later", async () => {
    const context: Record<string, unknown> = {};
    const handle = await startProcess(context, config, (stateKey) =>
      stateKey === "Playing"
        ? [
            async function* () {
              await new Promise((r) => setTimeout(r, 20));
              yield "pause";
            },
          ]
        : [],
    );
    await handle.dispatch("play");
    expect(context[KEY_STATES]).toEqual(["Player", "Active", "Playing"]);
    await new Promise((r) => setTimeout(r, 40));
    expect(context[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
    await handle.shutdown();
  });

  it("async generator is returned when its state exits early", async () => {
    let finalized = false;
    const context: Record<string, unknown> = {};
    const handle = await startProcess(context, config, (stateKey) =>
      stateKey === "Playing"
        ? [
            async function* () {
              try {
                await new Promise((r) => setTimeout(r, 20));
                yield "pause";
              } finally {
                finalized = true;
              }
            },
          ]
        : [],
    );
    await handle.dispatch("play");
    await handle.dispatch("stop");
    await new Promise((r) => setTimeout(r, 40));
    expect(finalized).toBe(true);
    expect(context[KEY_STATES]).toEqual(["Player", "Idle"]); // "pause" never applied
    await handle.shutdown();
  });

  it("sync generator: applied before dispatch returns", () => {
    const context: Record<string, unknown> = {};
    const handle = startProcessSync(context, config, (stateKey) =>
      stateKey === "Playing"
        ? [
            function* () {
              yield "pause";
            },
          ]
        : [],
    );
    handle.dispatch("play");
    expect(context[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
  });
});

describe("README §5 — errors", () => {
  for (const [name, make] of [
    ["async", () => new FsmProcess(config)],
    ["sync", () => new FsmProcessSync(config)],
  ] as const) {
    it(`a throwing handler is reported, dispatch still succeeds (${name})`, async () => {
      const reports: [string, string][] = [];
      const fsm = make();
      fsm.onStateError((state: { key: string }, error: unknown) => {
        reports.push([state.key, (error as Error).message]);
      });
      (fsm as FsmProcessSync).onStateCreate((state) => {
        state.onEnter(() => {
          if (state.key === "Idle") throw new Error("boom");
        });
      });
      expect(await quietly(() => fsm.dispatch(""))).toBe(true);
      expect(reports).toEqual([["Idle", "boom"]]);
      expect(fsm.state?.key).toBe("Idle");
    });
  }

  it("sync engine reports an async handler as a TypeError", async () => {
    const errors: unknown[] = [];
    const fsm = new FsmProcessSync(config);
    fsm.onStateError((_, error) => errors.push(error));
    fsm.onStateCreate((state) => state.onEnter(async () => {}));
    await quietly(() => fsm.dispatch(""));
    expect(errors.length).toBe(2); // Player and Idle
    for (const e of errors) expect(e).toBeInstanceOf(TypeError);
  });
});

describe("README §6 — dump / restore", () => {
  it("round-trips within and across engines, with data hooks and extra args", async () => {
    const seenArgs: unknown[] = [];
    const attach = (state: {
      key: string;
      dump: (h: (s: unknown, data: Record<string, unknown>, ...a: unknown[]) => void) => unknown;
      restore: (h: (s: unknown, data: Record<string, unknown>, ...a: unknown[]) => void) => unknown;
    }) => {
      state.dump((_s, data, storage) => {
        data.where = state.key;
        seenArgs.push(storage);
      });
      state.restore((_s, data, storage) => {
        expect(data.where).toBe(state.key);
        seenArgs.push(storage);
      });
    };

    const fsm = new FsmProcess(config);
    fsm.onStateCreate(attach);
    await fsm.dispatch("");
    await fsm.dispatch("play");
    const snapshot = await fsm.dump("db");
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot.stack).toEqual([
      { key: "Player", data: { where: "Player" } },
      { key: "Active", data: { where: "Active" } },
      { key: "Playing", data: { where: "Playing" } },
    ]);

    const a2 = new FsmProcess(config);
    a2.onStateCreate(attach);
    await a2.restore(snapshot, "db");
    expect(a2.state?.key).toBe("Playing");

    const fsmSync = new FsmProcessSync(config);
    fsmSync.onStateCreate(attach);
    fsmSync.restore(snapshot, "db"); // async dump → sync engine
    expect(fsmSync.state?.key).toBe("Playing");
    fsmSync.dispatch("pause");

    const a3 = new FsmProcess(config);
    await a3.restore(fsmSync.dump()); // sync dump → async engine
    expect(a3.state?.key).toBe("Paused");
    expect(seenArgs.every((a) => a === "db" || a === undefined)).toBe(true);
    expect(seenArgs.filter((a) => a === "db")).toHaveLength(9);
  });

  for (const flavour of ["async", "sync"] as const) {
    it(`a handle's restore unwinds the live stack and does not re-run load (${flavour})`, async () => {
      const loads: string[] = [];
      const cleanups: string[] = [];
      const load = (key: string) => {
        loads.push(key);
        return [() => () => void cleanups.push(key)];
      };
      const src = new FsmProcessSync(config);
      src.dispatch("");
      src.dispatch("play");
      const snapshot = src.dump();

      const ctx: Record<string, unknown> = {};
      if (flavour === "async") {
        const handle = await startProcess(ctx, config, load);
        await handle.restore(snapshot);
      } else {
        startProcessSync(ctx, config, load).restore(snapshot);
      }
      expect(cleanups).toEqual(["Idle", "Player"]);
      expect(loads).toEqual(["Player", "Idle"]);
      expect(ctx[KEY_STATES]).toEqual(["Player", "Active", "Playing"]);
    });
  }
});

describe("README §7 — introspection", () => {
  it("works the same on both engines", async () => {
    const a = new FsmProcess(config);
    await a.dispatch("");
    await a.dispatch("play");
    const s = new FsmProcessSync(config);
    s.dispatch("");
    s.dispatch("play");
    for (const fsm of [a, s]) {
      expect(getStateTransitions(fsm.state)).toEqual([
        ["Active", "stop", "Idle"],
        ["Playing", "pause", "Paused"],
      ]);
      expect(isStateTransitionEnabled(fsm, "pause")).toBe(true);
      expect(isStateTransitionEnabled(fsm, "bogus")).toBe(false);
    }
    s.dispatch("bogus");
    expect(s.state).toBeUndefined(); // unguarded: the whole machine unwound
  });
});

describe("README §8 — printer & tracer", () => {
  it("prints prefixed, numbered, indented lines (either engine)", async () => {
    const lines: string[] = [];
    const print = (...args: unknown[]) => lines.push(args.join(""));
    const s = new FsmProcessSync(config);
    setProcessPrinter(s, { prefix: "[player]", lineNumbers: true, print });
    setProcessTracer(s);
    s.dispatch("");
    s.dispatch("play");
    expect(lines.slice(0, 3)).toEqual([
      '[player][1]<Player event="">',
      '[player][2]  <Idle event="">',
      '[player][3]  </Idle> <!-- event="play" -->',
    ]);

    const asyncLines: string[] = [];
    const a = new FsmProcess(config);
    setProcessPrinter(a, {
      prefix: "[player]",
      lineNumbers: true,
      print: (...args) => asyncLines.push(args.join("")),
    });
    setProcessTracer(a);
    await a.dispatch("");
    await a.dispatch("play");
    expect(asyncLines).toEqual(lines);
  });
});

describe("README §9 — one handler set on both runners", () => {
  it("produces the same log", async () => {
    type Ctx = { log: string[] };
    const handlers: Record<string, StageHandlerSync<Ctx>> = {
      Playing: (ctx) => {
        ctx.log.push("play");
        return () => {
          ctx.log.push("stop");
        };
      },
    };
    const load = (key: string) => (handlers[key] ? [handlers[key]] : []);
    const ctxA: Ctx = { log: [] };
    const ctxB: Ctx = { log: [] };
    const a = startProcessSync(ctxA, config, load);
    const b = await startProcess(ctxB, config, load);
    for (const e of ["play", "pause", "play", "stop"]) {
      a.dispatch(e);
      await b.dispatch(e);
    }
    expect(ctxA.log).toEqual(["play", "stop", "play", "stop"]);
    expect(ctxB.log).toEqual(ctxA.log);
  });
});

describe("README — onStateError scope", () => {
  for (const flavour of ["async", "sync"] as const) {
    it(`errors from onStateCreate handlers are only logged (${flavour})`, async () => {
      const fsm = flavour === "async" ? new FsmProcess(config) : new FsmProcessSync(config);
      const seen: unknown[] = [];
      const logged: unknown[] = [];
      fsm.onStateError((_s: unknown, e: unknown) => {
        seen.push(e);
      });
      (fsm as FsmProcessSync).onStateCreate(() => {
        throw new Error("create failed");
      });
      const orig = console.error;
      console.error = (e: unknown) => logged.push(e);
      try {
        await fsm.dispatch("");
      } finally {
        console.error = orig;
      }
      expect(seen).toEqual([]);
      expect(logged.length).toBeGreaterThan(0);
      expect(fsm.state?.key).toBe("Idle");
    });
  }
});
