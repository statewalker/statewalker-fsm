import {
  FsmProcess,
  type FsmProcessDump,
  type FsmStateConfig,
  KEY_TERMINATE,
  STATUS_FINISHED,
  startProcess,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

// Regression tests for defects found during the code review. Each `describe`
// documents one defect; the test was written red against the old code first.

const linear: FsmStateConfig = {
  key: "Root",
  transitions: [
    ["", "*", "A"],
    ["A", "next", "B"],
    ["B", "next", ""],
  ],
};

describe("handlers registered while a handler list is running (R1)", () => {
  it("an onExit handler that registers another onExit does not loop forever", async () => {
    const p = new FsmProcess(linear);
    let calls = 0;
    p.onStateCreate((s) => {
      if (s.key !== "A") return;
      s.onExit(() => {
        calls++;
        if (calls > 100) throw new Error("runaway");
        // Registering a sibling exit handler must not make the running
        // iteration re-visit this handler (onExit prepends to the list).
        s.onExit(() => {});
      });
    });
    await p.dispatch("");
    await p.dispatch("next");
    expect(calls).toBe(1);
  });

  it("an onEnter handler added during onEnter runs on the next entry, not the current one", async () => {
    const p = new FsmProcess(linear);
    const log: string[] = [];
    p.onStateCreate((s) => {
      if (s.key !== "A") return;
      s.onEnter(() => {
        log.push("first");
        s.onEnter(() => {
          log.push("late");
        });
      });
    });
    await p.dispatch("");
    expect(log).toEqual(["first"]);
  });
});

describe("events dispatched to a finished machine (R2)", () => {
  it("are not accumulated in the queue", async () => {
    const p = new FsmProcess(linear);
    await p.dispatch("");
    await p.dispatch("next");
    expect(await p.dispatch("next")).toBe(false);
    expect(p.status).toBe(STATUS_FINISHED);
    for (let i = 0; i < 10; i++) expect(await p.dispatch("next")).toBe(false);
    expect(p.nextEvents).toEqual([]);
  });

  it("events queued in the cycle that finishes the machine are discarded", async () => {
    const p = new FsmProcess(linear);
    p.onStateCreate((s) => {
      if (s.key === "Root") s.onExit(() => void p.dispatch("late"));
    });
    await p.dispatch("");
    await p.dispatch("next");
    await p.dispatch("next");
    expect(p.status).toBe(STATUS_FINISHED);
    expect(p.nextEvents).toEqual([]);
  });
});

describe("shutdown (R3)", () => {
  it("a shut-down machine that was never started does not start afterwards", async () => {
    const p = new FsmProcess(linear);
    await p.shutdown();
    expect(await p.dispatch("")).toBe(false);
    expect(p.state).toBeUndefined();
  });

  it("concurrent shutdowns run each onExit exactly once", async () => {
    const p = new FsmProcess(linear);
    const exits: string[] = [];
    p.onStateCreate((s) => {
      s.onExit(async () => {
        await new Promise((r) => setTimeout(r, 5));
        exits.push(s.key);
      });
    });
    await p.dispatch("");
    await Promise.all([p.shutdown(), p.shutdown()]);
    expect(exits).toEqual(["A", "Root"]);
  });

  it("shutdown can be passed around as a bare callback", async () => {
    const p = new FsmProcess(linear);
    await p.dispatch("");
    const { shutdown } = p;
    await shutdown();
    expect(p.state).toBeUndefined();
  });
});

describe("startProcess handle.restore over a live process (R4)", () => {
  const cfg: FsmStateConfig = {
    key: "App",
    transitions: [
      ["", "*", "Idle"],
      ["Idle", "start", "Working"],
      ["Working", "done", "Idle"],
    ],
  };

  it("stops the generators and runs the cleanups of the states it replaces", async () => {
    // Snapshot a machine resting in "Working".
    const src = await startProcess({}, cfg, () => []);
    await src.dispatch("start");
    const dump: FsmProcessDump = await src.dump();
    await src.shutdown();

    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const cleanups: string[] = [];
    const ctx: Record<string, unknown> = {};
    const handle = await startProcess(ctx, cfg, (state) => {
      if (state !== "Idle") return [];
      return [
        () => () => {
          cleanups.push("Idle");
        },
        async function* () {
          await gate;
          // In the restored machine ("Working") "done" is enabled — a leaked
          // generator from the replaced "Idle" would wrongly fire it.
          yield "done";
        },
      ];
    });
    await handle.restore(dump);
    expect(cleanups).toEqual(["Idle"]);
    release();
    await new Promise((r) => setTimeout(r, 10));
    const after = await handle.dump();
    expect(after.stack.map((s) => s.key)).toEqual(["App", "Working"]);
    await (ctx[KEY_TERMINATE] as () => Promise<void>)();
  });
});
