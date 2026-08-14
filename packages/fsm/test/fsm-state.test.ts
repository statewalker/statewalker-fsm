import {
  FsmProcess,
  type FsmState,
  type FsmStateConfig,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

const simpleConfig: FsmStateConfig = {
  key: "Root",
  transitions: [
    ["", "*", "A"],
    ["A", "next", "B"],
    ["B", "*", ""],
  ],
};

describe("FsmState", () => {
  it("has correct properties after creation", async () => {
    const process = new FsmProcess(simpleConfig);
    let createdState: FsmState | undefined;
    process.onStateCreate((state) => {
      if (!createdState) createdState = state;
    });
    await process.dispatch("");
    expect(createdState).toBeDefined();
    expect(createdState?.key).toBe("Root");
    expect(createdState?.process).toBe(process);
    expect(createdState?.parent).toBeUndefined();
    expect(createdState?.descriptor).toBeDefined();
  });

  it("child state has parent reference", async () => {
    const process = new FsmProcess(simpleConfig);
    const states: FsmState[] = [];
    process.onStateCreate((state) => {
      states.push(state);
    });
    await process.dispatch("");
    // Root and A are created
    expect(states.length).toBe(2);
    expect(states[1].key).toBe("A");
    expect(states[1].parent).toBe(states[0]);
  });

  it("onEnter handler fires on state entry", async () => {
    const process = new FsmProcess(simpleConfig);
    const entered: string[] = [];
    process.onStateCreate((state) => {
      state.onEnter(() => {
        entered.push(state.key);
      });
    });
    await process.dispatch("");
    expect(entered).toEqual(["Root", "A"]);
  });

  it("onExit handler fires on state exit", async () => {
    const process = new FsmProcess(simpleConfig);
    const exited: string[] = [];
    process.onStateCreate((state) => {
      state.onExit(() => {
        exited.push(state.key);
      });
    });
    await process.dispatch("");
    await process.dispatch("next");
    expect(exited).toContain("A");
  });

  it("onExit handlers run in reverse registration order", async () => {
    const process = new FsmProcess(simpleConfig);
    const calls: number[] = [];
    process.onStateCreate((state) => {
      if (state.key === "A") {
        state.onExit(() => {
          calls.push(1);
        });
        state.onExit(() => {
          calls.push(2);
        });
        state.onExit(() => {
          calls.push(3);
        });
      }
    });
    await process.dispatch("");
    await process.dispatch("next");
    // onExit uses direct=false (unshift), so last registered runs first
    expect(calls).toEqual([3, 2, 1]);
  });

  it("dump handler is called during process.dump()", async () => {
    const process = new FsmProcess(simpleConfig);
    process.onStateCreate((state) => {
      state.dump((_state, data) => {
        data.custom = `dumped-${state.key}`;
      });
    });
    await process.dispatch("");
    const dump = await process.dump();
    expect(dump.stack[0].data.custom).toBe("dumped-Root");
    expect(dump.stack[1].data.custom).toBe("dumped-A");
  });

  it("restore handler is called during process.restore()", async () => {
    const process = new FsmProcess(simpleConfig);
    const restored: string[] = [];
    process.onStateCreate((state) => {
      state.dump((_state, data) => {
        data.marker = state.key;
      });
      state.restore((_state, data) => {
        restored.push(data.marker as string);
      });
    });
    await process.dispatch("");
    const dump = await process.dump();

    const process2 = new FsmProcess(simpleConfig);
    process2.onStateCreate((state) => {
      state.restore((_state, data) => {
        restored.push(data.marker as string);
      });
    });
    await process2.restore(dump);
    expect(restored).toEqual(["Root", "A"]);
  });

  it("onStateError handler is invoked on error", async () => {
    const process = new FsmProcess(simpleConfig);
    const errors: string[] = [];
    // Suppress default console.error
    process._handleError = async () => {};
    process.onStateCreate((state) => {
      state.onStateError((_s, error) => {
        errors.push(`${state.key}:${(error as Error).message}`);
      });
      if (state.key === "A") {
        state.onEnter(() => {
          throw new Error("test-error");
        });
      }
    });
    await process.dispatch("");
    expect(errors).toContain("A:test-error");
  });

  it("bound methods work when detached", async () => {
    const process = new FsmProcess(simpleConfig);
    let detachedOnEnter: FsmState["onEnter"] | undefined;
    let detachedDump: FsmState["dump"] | undefined;
    process.onStateCreate((state) => {
      if (state.key === "Root") {
        detachedOnEnter = state.onEnter;
        detachedDump = state.dump;
      }
    });
    await process.dispatch("");
    expect(detachedOnEnter).toBeDefined();
    expect(detachedDump).toBeDefined();

    // Should not throw when called detached (bound via bindMethods)
    const calls: string[] = [];
    detachedOnEnter?.(() => {
      calls.push("entered");
    });
    detachedDump?.((_s, data) => {
      data.test = true;
    });
    const dump = await process.dump();
    expect(dump.stack[0].data.test).toBe(true);
  });
});
