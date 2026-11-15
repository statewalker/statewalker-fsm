import { type FsmStep, type FsmSteps, runAsync, runSync } from "../src/core/fsm-controller.ts";
import {
  FsmProcess,
  type FsmProcessDump,
  FsmProcessSync,
  type FsmStateConfig,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

// statewalker-fsm#21: one engine controller, driven two ways. These tests pin
// the drivers and run the same scenarios on both engines, expecting the same
// transcript, the same results and the same final machine state.

describe("drivers", () => {
  const step = (fn: () => unknown) => ({ run: fn }) as unknown as FsmStep;

  function* program(log: string[]): FsmSteps<string> {
    try {
      const a = yield step(() => "a");
      log.push(`got ${a}`);
      yield step(() => {
        throw new Error("boom");
      });
      log.push("not reached");
      return "done";
    } finally {
      log.push("finally");
    }
  }

  it("runSync sends results back and throws a failing step into the program", () => {
    const log: string[] = [];
    expect(() => runSync(program(log))).toThrow("boom");
    expect(log).toEqual(["got a", "finally"]);
  });

  it("runAsync does the same, awaiting each step", async () => {
    const log: string[] = [];
    await expect(runAsync(program(log))).rejects.toThrow("boom");
    expect(log).toEqual(["got a", "finally"]);
  });

  it("runAsync awaits promised step results", async () => {
    function* p(): FsmSteps<number> {
      const v = (yield step(() => Promise.resolve(41))) as number;
      return v + 1;
    }
    expect(await runAsync(p())).toBe(42);
  });
});

const player: FsmStateConfig = {
  key: "Player",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "play", "Active"],
    ["*", "stop", "Idle"],
    ["Idle", "quit", ""],
  ],
  states: [
    {
      key: "Active",
      transitions: [
        ["", "*", "Playing"],
        ["Playing", "pause", "Paused"],
        ["Paused", "play", "Playing"],
      ],
    },
  ],
};

type Engine = FsmProcess | FsmProcessSync;
type Scenario = {
  name: string;
  /** Extra per-state hooks; `log` is the shared transcript. */
  setup?: (p: Engine, log: string[]) => void;
  /** The calls, made in turn (the async engine's results are awaited). */
  run: (p: Engine, log: string[]) => (() => unknown)[];
};

function instrument(p: Engine, log: string[]) {
  (p as FsmProcessSync).onStateCreate((s) => {
    log.push(`create ${s.key}`);
    s.onEnter(() => log.push(`enter ${s.key}`));
    s.onExit(() => log.push(`exit ${s.key}:${p.event}`));
    s.dump((_, data) => {
      data.k = s.key;
    });
    s.restore((_, data) => log.push(`restore ${s.key} ${String(data.k)}`));
  });
}

function stackOf(p: Engine) {
  const keys: string[] = [];
  for (let s = p.state; s; s = s.parent) keys.unshift(s.key);
  return keys;
}

const scenarios: Scenario[] = [
  {
    name: "plain dispatch through nested states",
    run: (p) => ["", "play", "pause", "play", "stop", "quit"].map((e) => () => p.dispatch(e)),
  },
  {
    name: "re-entrant dispatch from onEnter is queued in order",
    setup: (p) =>
      (p as FsmProcessSync).onStateCreate((s) => {
        if (s.key === "Playing") s.onEnter(() => void p.dispatch("pause"));
        if (s.key === "Paused") s.onEnter(() => void p.dispatch("stop"));
      }),
    run: (p) => [() => p.dispatch(""), () => p.dispatch("play")],
  },
  {
    name: "shutdown requested from onEnter unwinds once",
    setup: (p) =>
      (p as FsmProcessSync).onStateCreate((s) => {
        if (s.key === "Playing") s.onEnter(() => void p.shutdown("bye"));
      }),
    run: (p) => [() => p.dispatch(""), () => p.dispatch("play"), () => p.dispatch("stop")],
  },
  {
    name: "shutdown requested while a state is created discards it",
    setup: (p) =>
      (p as FsmProcessSync).onStateCreate((s) => {
        if (s.key === "Paused") void p.shutdown("halt");
      }),
    run: (p) => [() => p.dispatch(""), () => p.dispatch("play"), () => p.dispatch("pause")],
  },
  {
    name: "shutdown requested from onExit during a transition",
    setup: (p) =>
      (p as FsmProcessSync).onStateCreate((s) => {
        if (s.key === "Idle") s.onExit(() => void p.shutdown("cut"));
      }),
    run: (p) => [() => p.dispatch(""), () => p.dispatch("play")],
  },
  {
    name: "event filter drops events where they land",
    setup: (p) => {
      p.eventFilter = (e) => e !== "pause";
    },
    run: (p) => [
      () => p.dispatch(""),
      () => p.dispatch("play"),
      () => p.dispatch("pause"),
      () => p.dispatch("stop"),
    ],
  },
  {
    name: "a throwing handler is reported and the run goes on",
    setup: (p, log) => {
      (p as FsmProcessSync).onStateError((s, e) => log.push(`error ${s.key} ${String(e)}`));
      (p as FsmProcessSync).onStateCreate((s) => {
        if (s.key === "Active")
          s.onEnter(() => {
            throw new Error("bad");
          });
      });
    },
    run: (p) => [() => p.dispatch(""), () => p.dispatch("play"), () => p.dispatch("pause")],
  },
];

async function play(engine: Engine, scenario: Scenario) {
  const log: string[] = [];
  instrument(engine, log);
  scenario.setup?.(engine, log);
  const results: unknown[] = [];
  for (const call of scenario.run(engine, log)) results.push(await call());
  if (engine instanceof FsmProcess) await engine.whenIdle();
  return { log, results, status: engine.status, stack: stackOf(engine) };
}

describe("both engines run one controller: same transcript", () => {
  for (const scenario of scenarios) {
    it(scenario.name, async () => {
      const a = await play(new FsmProcess(player), scenario);
      const s = await play(new FsmProcessSync(player), scenario);
      expect(s).toEqual(a);
      expect(a.log.length).toBeGreaterThan(0);
    });
  }

  it("dump and restore round-trip identically", async () => {
    const asyncEngine = new FsmProcess(player);
    const syncEngine = new FsmProcessSync(player);
    const logA: string[] = [];
    const logS: string[] = [];
    instrument(asyncEngine, logA);
    instrument(syncEngine, logS);
    for (const e of ["", "play", "pause"]) {
      await asyncEngine.dispatch(e);
      syncEngine.dispatch(e);
    }
    const dumpA = await asyncEngine.dump();
    const dumpS = syncEngine.dump();
    expect(dumpS).toEqual(dumpA);

    const restoredA = new FsmProcess(player);
    const restoredS = new FsmProcessSync(player);
    const rA: string[] = [];
    const rS: string[] = [];
    instrument(restoredA, rA);
    instrument(restoredS, rS);
    await restoredA.restore(dumpS as FsmProcessDump);
    restoredS.restore(dumpA);
    expect(rS).toEqual(rA);
    expect(stackOf(restoredS)).toEqual(["Player", "Active", "Paused"]);
    expect(stackOf(restoredA)).toEqual(stackOf(restoredS));
  });

  it("restore while running fails the same way", async () => {
    const message = (owner: string) =>
      `${owner}.restore() called while a dispatch or shutdown is running`;
    const a = new FsmProcess(player);
    let errorA: unknown;
    a.onStateCreate((s) => {
      s.onEnter(async () => {
        errorA ??= await a.restore({ status: 0, stack: [] }).catch((e) => e);
      });
    });
    await a.dispatch("");
    expect(String(errorA)).toContain(message("FsmProcess"));

    const s = new FsmProcessSync(player);
    let errorS: unknown;
    s.onStateCreate((st) => {
      st.onEnter(() => {
        try {
          s.restore({ status: 0, stack: [] });
        } catch (e) {
          errorS ??= e;
        }
      });
    });
    s.dispatch("");
    expect(String(errorS)).toContain(message("FsmProcessSync"));
  });
});

describe("one reused step per engine (#60)", () => {
  function engines() {
    return [new FsmProcess(player), new FsmProcessSync(player)] as const;
  }

  it("keeps no state, handler arguments or callbacks between dispatches", async () => {
    for (const engine of engines()) {
      instrument(engine, []);
      for (const e of ["", "play", "pause"]) await engine.dispatch(e);
      await engine.dump("extra-arg");
      await engine.shutdown("bye");
      const step = (engine as unknown as { _step: Record<string, unknown> })._step;
      expect(step).toBeDefined();
      for (const field of ["target", "engine", "parent", "descriptor", "fn"]) {
        expect(step[field]).toBeUndefined();
      }
      expect(step.args).toEqual([]);
    }
  });

  it("is reused: the same record serves every dispatch", async () => {
    for (const engine of engines()) {
      const before = (engine as unknown as { _step: unknown })._step;
      expect(before).toBeDefined();
      for (const e of ["", "play", "pause"]) await engine.dispatch(e);
      expect((engine as unknown as { _step: unknown })._step).toBe(before);
    }
  });

  it("stays correct when a handler dumps and dispatches while a step is running", async () => {
    const run = async (engine: Engine) => {
      const log: string[] = [];
      instrument(engine, log);
      (engine as FsmProcessSync).onStateCreate((s) => {
        if (s.key === "Playing")
          s.onEnter(async () => {
            const dump = await engine.dump();
            log.push(`dumped ${dump.stack.map((d) => d.key).join("/")}`);
            void engine.dispatch("pause");
          });
      });
      for (const e of ["", "play"]) await engine.dispatch(e);
      if (engine instanceof FsmProcess) await engine.whenIdle();
      return { log, stack: stackOf(engine) };
    };
    const a = await run(new FsmProcess(player));
    const s = await run(new FsmProcessSync(player));
    expect(a.stack).toEqual(["Player", "Active", "Paused"]);
    expect(a.log).toContain("dumped Player/Active/Playing");
    expect(s.stack).toEqual(a.stack);
  });
});
