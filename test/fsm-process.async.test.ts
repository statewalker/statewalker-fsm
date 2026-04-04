import {
  FsmProcess,
  type FsmStateConfig,
  STATUS_FINISHED,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

function delay(ms = 0): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const config: FsmStateConfig = {
  key: "Root",
  transitions: [
    ["", "*", "A"],
    ["A", "next", "B"],
    ["B", "next", "C"],
    ["C", "*", ""],
  ],
};

const loopConfig: FsmStateConfig = {
  key: "App",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "start", "Working"],
    ["Working", "done", "Idle"],
    ["*", "quit", ""],
  ],
};

describe("FsmProcess: async handlers", () => {
  it("async onEnter completes before dispatch returns", async () => {
    const p = new FsmProcess(config);
    const timeline: string[] = [];
    p.onStateCreate((state) => {
      state.onEnter(async () => {
        timeline.push(`enter-start:${state.key}`);
        await delay(5);
        timeline.push(`enter-end:${state.key}`);
      });
    });
    await p.dispatch("");
    // All async enters should have completed
    expect(timeline).toEqual([
      "enter-start:Root",
      "enter-end:Root",
      "enter-start:A",
      "enter-end:A",
    ]);
  });

  it("async onExit completes before next state enters", async () => {
    const p = new FsmProcess(config);
    const timeline: string[] = [];
    p.onStateCreate((state) => {
      state.onEnter(() => {
        timeline.push(`enter:${state.key}`);
      });
      state.onExit(async () => {
        timeline.push(`exit-start:${state.key}`);
        await delay(5);
        timeline.push(`exit-end:${state.key}`);
      });
    });
    await p.dispatch("");
    await p.dispatch("next");
    // A's async exit should complete before B's enter
    expect(timeline).toEqual([
      "enter:Root",
      "enter:A",
      "exit-start:A",
      "exit-end:A",
      "enter:B",
    ]);
  });

  it("multiple async handlers on same state run sequentially", async () => {
    const p = new FsmProcess(config);
    const order: number[] = [];
    p.onStateCreate((state) => {
      if (state.key === "A") {
        state.onEnter(async () => {
          order.push(1);
          await delay(5);
          order.push(2);
        });
        state.onEnter(async () => {
          order.push(3);
          await delay(5);
          order.push(4);
        });
      }
    });
    await p.dispatch("");
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it("async error in onEnter is caught", async () => {
    const p = new FsmProcess(config);
    const errors: string[] = [];
    p._handleError = async () => {};
    p.onStateError((_state, error) => {
      errors.push((error as Error).message);
    });
    p.onStateCreate((state) => {
      if (state.key === "A") {
        state.onEnter(async () => {
          await delay(1);
          throw new Error("async-boom");
        });
      }
    });
    await p.dispatch("");
    expect(errors).toContain("async-boom");
  });

  it("queued dispatch runs after current dispatch completes", async () => {
    const p = new FsmProcess(loopConfig);
    const path: string[] = [];
    p.onStateCreate((state) => {
      state.onEnter(async () => {
        path.push(state.key);
        if (state.key === "Idle" && path.length === 2) {
          // Queue next dispatch while we're in the onEnter handler
          // (path = [App, Idle] on first Idle entry)
          p.dispatch("start");
        }
      });
    });
    await p.dispatch("");
    // After initial dispatch enters App→Idle, then queued "start" transitions to Working
    expect(path).toContain("Idle");
    expect(path).toContain("Working");
  });

  it("full async lifecycle with enter, work, exit", async () => {
    const p = new FsmProcess(loopConfig);
    const log: string[] = [];
    p.onStateCreate((state) => {
      state.onEnter(async () => {
        log.push(`+${state.key}`);
        await delay(2);
      });
      state.onExit(async () => {
        log.push(`-${state.key}`);
        await delay(2);
      });
    });

    await p.dispatch("");
    expect(log).toEqual(["+App", "+Idle"]);

    await p.dispatch("start");
    expect(log).toEqual(["+App", "+Idle", "-Idle", "+Working"]);

    await p.dispatch("done");
    expect(log).toEqual([
      "+App",
      "+Idle",
      "-Idle",
      "+Working",
      "-Working",
      "+Idle",
    ]);

    await p.dispatch("quit");
    expect(log).toEqual([
      "+App",
      "+Idle",
      "-Idle",
      "+Working",
      "-Working",
      "+Idle",
      "-Idle",
      "-App",
    ]);
    expect(p.status & STATUS_FINISHED).toBeTruthy();
  });

  it("shutdown during async handler", async () => {
    const p = new FsmProcess(config);
    const exits: string[] = [];
    p.onStateCreate((state) => {
      state.onExit(async () => {
        exits.push(state.key);
        await delay(2);
      });
    });
    await p.dispatch("");
    await p.shutdown();
    expect(exits).toContain("A");
    expect(exits).toContain("Root");
    expect(p.status).toBe(STATUS_FINISHED);
  });

  it("dump/restore preserves state after async operations", async () => {
    const p = new FsmProcess(loopConfig);
    p.onStateCreate((state) => {
      state.dump((_s, data) => {
        data.key = state.key;
      });
    });

    await p.dispatch("");
    await p.dispatch("start");
    const snapshot = await p.dump();
    expect(snapshot.stack.map((s) => s.key)).toEqual(["App", "Working"]);

    const p2 = new FsmProcess(loopConfig);
    await p2.restore(snapshot);
    expect(p2.state?.key).toBe("Working");
    expect(p2.state?.parent?.key).toBe("App");

    // Continue from restored state
    await p2.dispatch("done");
    expect(p2.state?.key).toBe("Idle");
  });
});
