import {
  FsmProcess,
  FsmProcessSync,
  type FsmStateConfig,
  KEY_DISPATCH,
  KEY_STATES,
  KEY_TERMINATE,
  STATUS_FINISHED,
  type StageHandlerSync,
  startProcess,
  startProcessSync,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

// Regression tests for the second review round (independent reviewer findings).

const cfg: FsmStateConfig = {
  key: "Root",
  transitions: [
    ["", "*", "A"],
    ["A", "go", "B"],
  ],
};

const player: FsmStateConfig = {
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
    },
  ],
};

type Log = string[];
function instrument(p: FsmProcess | FsmProcessSync, log: Log) {
  (p as FsmProcessSync).onStateCreate((s) => {
    log.push(`create ${s.key}`);
    s.onEnter(() => log.push(`enter ${s.key}`));
    s.onExit(() => log.push(`exit ${s.key}`));
  });
}

describe("shutdown requested while the machine is busy (round 2, #1/#2)", () => {
  it("async: shutdown awaited from an onExit during a transition does not recurse or deadlock", async () => {
    const p = new FsmProcess(cfg);
    const log: Log = [];
    instrument(p, log);
    p.onStateCreate((s) => {
      if (s.key === "A") {
        s.onExit(async () => {
          await p.shutdown();
        });
      }
    });
    await p.dispatch("");
    log.length = 0;
    expect(await p.dispatch("go")).toBe(false);
    expect(log).toEqual(["exit A", "exit Root"]);
    expect(p.state).toBeUndefined();
    expect(p.status).toBe(STATUS_FINISHED);
  });

  it("async: shutdown awaited from an onExit during a shutdown resolves", async () => {
    const p = new FsmProcess(cfg);
    const log: Log = [];
    instrument(p, log);
    p.onStateCreate((s) => {
      s.onExit(async () => {
        await Promise.resolve();
        await p.shutdown();
      });
    });
    await p.dispatch("");
    log.length = 0;
    const done = p.shutdown().then(() => "done");
    const timeout = new Promise((r) => setTimeout(() => r("timeout"), 100));
    expect(await Promise.race([done, timeout])).toBe("done");
    expect(log).toEqual(["exit A", "exit Root"]);
  });

  it("sync: shutdown from an onExit during a transition exits each state once", () => {
    const p = new FsmProcessSync(cfg);
    const log: Log = [];
    instrument(p, log);
    p.onStateCreate((s) => {
      if (s.key === "A") s.onExit(() => p.shutdown());
    });
    p.dispatch("");
    log.length = 0;
    expect(p.dispatch("go")).toBe(false);
    expect(log).toEqual(["exit A", "exit Root"]);
    expect(p.state).toBeUndefined();
  });

  for (const flavour of ["async", "sync"] as const) {
    it(`${flavour}: shutdown from onStateCreate discards the state being created`, async () => {
      const p = flavour === "async" ? new FsmProcess(cfg) : new FsmProcessSync(cfg);
      const log: Log = [];
      instrument(p, log);
      (p as FsmProcessSync).onStateCreate((s) => {
        if (s.key === "B") void p.shutdown();
      });
      await p.dispatch("");
      log.length = 0;
      expect(await p.dispatch("go")).toBe(false);
      expect(log).toEqual(["exit A", "create B", "exit Root"]);
      expect(p.state).toBeUndefined();
      expect(p.status).toBe(STATUS_FINISHED);
    });
  }

  it("async: an external shutdown during an async onStateCreate does not revive the machine", async () => {
    const p = new FsmProcess(cfg);
    const log: Log = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    let markCreating: () => void = () => {};
    const creating = new Promise<void>((r) => {
      markCreating = r;
    });
    instrument(p, log);
    p.onStateCreate(async (s) => {
      if (s.key !== "B") return;
      markCreating();
      await gate;
    });
    await p.dispatch("");
    log.length = 0;
    const running = p.dispatch("go");
    await creating; // B is being created right now
    const shut = p.shutdown();
    release();
    await Promise.all([running, shut]);
    expect(log).toEqual(["exit A", "create B", "exit Root"]);
    expect(p.state).toBeUndefined();
    expect(p.status).toBe(STATUS_FINISHED);
  });

  it("async: an external shutdown waits for a slow onEnter before exiting that state", async () => {
    const p = new FsmProcess(cfg);
    const log: Log = [];
    p.onStateCreate((s) => {
      s.onEnter(async () => {
        log.push(`enter ${s.key}`);
        if (s.key === "B") await new Promise((r) => setTimeout(r, 10));
        log.push(`entered ${s.key}`);
      });
      s.onExit(() => {
        log.push(`exit ${s.key}`);
      });
    });
    await p.dispatch("");
    log.length = 0;
    const running = p.dispatch("go");
    await new Promise((r) => setTimeout(r, 1));
    await p.shutdown();
    await running;
    expect(log).toEqual(["exit A", "enter B", "entered B", "exit B", "exit Root"]);
  });

  it("whenIdle resolves once the running dispatch (and any requested shutdown) is over", async () => {
    const p = new FsmProcess(cfg);
    p.onStateCreate((s) => {
      s.onEnter(async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
    });
    const running = p.dispatch("");
    expect(p.running).toBe(true);
    await p.whenIdle();
    expect(p.running).toBe(false);
    expect(p.state?.key).toBe("A");
    await running;
  });

  for (const flavour of ["async", "sync"] as const) {
    it(`${flavour}: restore while a dispatch is running throws`, async () => {
      const p = flavour === "async" ? new FsmProcess(cfg) : new FsmProcessSync(cfg);
      await p.dispatch("");
      const snapshot = await p.dump();
      let error: unknown;
      (p as FsmProcessSync).onStateCreate((s) => {
        s.onEnter(() => {
          try {
            const result = p.restore(snapshot) as unknown;
            if (result instanceof Promise) result.catch((e) => (error = e));
          } catch (e) {
            error = e;
          }
        });
      });
      await p.dispatch("go");
      expect(error).toBeInstanceOf(Error);
      expect(p.state?.key).toBe("B");
    });
  }
});

describe("runner parity with generators (round 2, #3)", () => {
  const load = (key: string) =>
    key === "Active"
      ? [
          function* () {
            yield "pause";
          },
        ]
      : [];

  it("a generator on a composite state: both runners end in the same state", async () => {
    const ctxSync: Record<string, unknown> = {};
    startProcessSync(ctxSync, player, load).dispatch("play");
    expect(ctxSync[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);

    const ctxAsync: Record<string, unknown> = {};
    const handle = await startProcess(ctxAsync, player, load);
    await handle.dispatch("play");
    await new Promise((r) => setTimeout(r, 10));
    expect(ctxAsync[KEY_STATES]).toEqual(ctxSync[KEY_STATES]);
    await handle.shutdown();
  });

  it("a multi-step generator: same transcript on both runners", async () => {
    const steps: StageHandlerSync = function* () {
      yield "pause";
      yield "play";
      yield "pause";
    };
    const run = async (flavour: "sync" | "async") => {
      const log: string[] = [];
      const ctx: Record<string, unknown> = {};
      const loader = (key: string) => [
        () => {
          log.push(`+${key}`);
          return () => {
            log.push(`-${key}`);
          };
        },
        ...(key === "Active" ? [steps] : []),
      ];
      if (flavour === "sync") startProcessSync(ctx, player, loader).dispatch("play");
      else {
        const h = await startProcess(ctx, player, loader);
        await h.dispatch("play");
        await new Promise((r) => setTimeout(r, 10));
      }
      return log;
    };
    const sync = await run("sync");
    expect(sync).toEqual([
      "+Player",
      "+Idle",
      "-Idle",
      "+Active",
      "+Playing",
      "-Playing",
      "+Paused",
      "-Paused",
      "+Playing",
      "-Playing",
      "+Paused",
    ]);
    expect(await run("async")).toEqual(sync);
  });
});

describe("startProcessSync generators and async handlers (round 2, #4/#5)", () => {
  it("a generator that leaves its own state from its body is still finalized", () => {
    const log: string[] = [];
    const ctx: Record<string, unknown> = {};
    startProcessSync(ctx, player, (key) =>
      key === "Playing"
        ? [
            function* (c: Record<string, unknown>) {
              try {
                yield "noop-not-enabled";
                (c[KEY_DISPATCH] as (e: string) => void)("pause");
                log.push("after dispatch in body");
                yield "y";
                log.push("unreachable");
              } finally {
                log.push("finally");
              }
            },
          ]
        : [],
    ).dispatch("play");
    expect(ctx[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
    expect(log).toEqual(["after dispatch in body", "finally"]);
  });

  it("async stage handlers and async generators go to onStateError as TypeErrors", async () => {
    // Observe through console.error, the terminal error sink.
    const logged: unknown[] = [];
    const orig = console.error;
    console.error = (e: unknown) => logged.push(e);
    try {
      const ctx: Record<string, unknown> = {};
      startProcessSync(ctx, player, (key) =>
        key === "Idle"
          ? [
              (async () => {
                throw new Error("async failure");
              }) as unknown as StageHandlerSync,
              async function* () {
                yield "play";
              } as unknown as StageHandlerSync,
            ]
          : [],
      );
      await new Promise((r) => setTimeout(r, 5));
      expect(ctx[KEY_STATES]).toEqual(["Player", "Idle"]);
    } finally {
      console.error = orig;
    }
    const typeErrors = logged.filter((e) => e instanceof TypeError);
    expect(typeErrors).toHaveLength(2);
    expect(logged.some((e) => (e as Error)?.message === "async failure")).toBe(true);
  });
});
