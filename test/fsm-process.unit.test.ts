import {
  FsmProcess,
  type FsmStateConfig,
  STATUS_FINISHED,
  STATUS_FIRST,
  STATUS_LEAF,
  STATUS_NONE,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

const linearConfig: FsmStateConfig = {
  key: "Root",
  transitions: [
    ["", "*", "A"],
    ["A", "next", "B"],
    ["B", "next", "C"],
    ["C", "*", ""],
  ],
};

const nestedConfig: FsmStateConfig = {
  key: "Root",
  transitions: [
    ["", "*", "Parent"],
    ["Parent", "done", ""],
  ],
  states: [
    {
      key: "Parent",
      transitions: [
        ["", "*", "Child1"],
        ["Child1", "next", "Child2"],
        ["Child2", "*", ""],
      ],
    },
  ],
};

describe("FsmProcess", () => {
  describe("initial state", () => {
    it("starts with STATUS_NONE", () => {
      const p = new FsmProcess(linearConfig);
      expect(p.status).toBe(STATUS_NONE);
      expect(p.state).toBeUndefined();
      expect(p.running).toBe(false);
      expect(p.event).toBeUndefined();
    });

    it("has default mask of STATUS_LEAF", () => {
      const p = new FsmProcess(linearConfig);
      expect(p.mask).toBe(STATUS_LEAF);
    });
  });

  describe("dispatch", () => {
    it("enters root and first child on initial dispatch", async () => {
      const p = new FsmProcess(linearConfig);
      const result = await p.dispatch("");
      expect(result).toBe(true);
      expect(p.state?.key).toBe("A");
      expect(p.status).toBe(STATUS_LEAF);
    });

    it("transitions through states", async () => {
      const p = new FsmProcess(linearConfig);
      await p.dispatch("");
      expect(p.state?.key).toBe("A");

      await p.dispatch("next");
      expect(p.state?.key).toBe("B");

      await p.dispatch("next");
      expect(p.state?.key).toBe("C");
    });

    it("finishes when reaching final state", async () => {
      const p = new FsmProcess(linearConfig);
      await p.dispatch("");
      await p.dispatch("next");
      await p.dispatch("next");
      // C has "*" → "" which means exit
      const result = await p.dispatch("done");
      expect(result).toBe(false);
      expect(p.status & STATUS_FINISHED).toBeTruthy();
      expect(p.state).toBeUndefined();
    });

    it("returns false when already finished", async () => {
      const p = new FsmProcess(linearConfig);
      await p.dispatch("");
      await p.dispatch("next");
      await p.dispatch("next");
      await p.dispatch("done");
      const result = await p.dispatch("anything");
      expect(result).toBe(false);
    });

    it("queues nextEvent when dispatched during running", async () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "go", "B"],
          ["B", "*", ""],
        ],
      };
      const p = new FsmProcess(config);
      const path: string[] = [];
      p.onStateCreate((state) => {
        state.onEnter(() => {
          path.push(`enter:${state.key}`);
          if (state.key === "A") {
            // Dispatch while running — should queue
            p.dispatch("go");
          }
        });
        state.onExit(() => {
          path.push(`exit:${state.key}`);
        });
      });
      await p.dispatch("");
      // After initial dispatch, "go" should have been queued and executed
      expect(path).toContain("enter:B");
    });
  });

  describe("status flags", () => {
    it("STATUS_FIRST on first entry", async () => {
      const p = new FsmProcess(linearConfig);
      const statuses: number[] = [];
      p.onStateCreate((state) => {
        state.onEnter(() => {
          if (state.key === "A") statuses.push(p.status);
        });
      });
      await p.dispatch("");
      expect(statuses[0]).toBe(STATUS_FIRST);
    });

    it("STATUS_LEAF when at leaf state", async () => {
      const p = new FsmProcess(linearConfig);
      await p.dispatch("");
      expect(p.status).toBe(STATUS_LEAF);
    });
  });

  describe("nested states", () => {
    it("enters nested hierarchy", async () => {
      const p = new FsmProcess(nestedConfig);
      const path: string[] = [];
      p.onStateCreate((state) => {
        state.onEnter(() => {
          path.push(state.key);
        });
      });
      await p.dispatch("");
      expect(path).toEqual(["Root", "Parent", "Child1"]);
    });

    it("state has correct parent chain", async () => {
      const p = new FsmProcess(nestedConfig);
      await p.dispatch("");
      expect(p.state?.key).toBe("Child1");
      expect(p.state?.parent?.key).toBe("Parent");
      expect(p.state?.parent?.parent?.key).toBe("Root");
      expect(p.state?.parent?.parent?.parent).toBeUndefined();
    });

    it("transitions within nested states", async () => {
      const p = new FsmProcess(nestedConfig);
      await p.dispatch("");
      expect(p.state?.key).toBe("Child1");

      await p.dispatch("next");
      expect(p.state?.key).toBe("Child2");
      expect(p.state?.parent?.key).toBe("Parent");
    });

    it("exits to parent when child substates exhausted", async () => {
      const p = new FsmProcess(nestedConfig);
      const exits: string[] = [];
      p.onStateCreate((state) => {
        state.onExit(() => {
          exits.push(state.key);
        });
      });
      await p.dispatch("");
      await p.dispatch("next");
      // Child2 → "" exits Parent, then "done" exits Root
      await p.dispatch("anything");
      // Child2 exits, Parent exits
      expect(exits).toContain("Child2");
      expect(exits).toContain("Parent");
    });
  });

  describe("shutdown", () => {
    it("exits all states from leaf to root", async () => {
      const p = new FsmProcess(nestedConfig);
      const exits: string[] = [];
      p.onStateCreate((state) => {
        state.onExit(() => {
          exits.push(state.key);
        });
      });
      await p.dispatch("");
      expect(p.state?.key).toBe("Child1");

      await p.shutdown();
      expect(exits).toEqual(["Child1", "Parent", "Root"]);
      expect(p.state).toBeUndefined();
      expect(p.status).toBe(STATUS_FINISHED);
    });

    it("sets STATUS_FINISHED on each exit", async () => {
      const p = new FsmProcess(linearConfig);
      const statuses: number[] = [];
      p.onStateCreate((state) => {
        state.onExit(() => {
          statuses.push(p.status);
        });
      });
      await p.dispatch("");
      await p.shutdown();
      for (const s of statuses) {
        expect(s).toBe(STATUS_FINISHED);
      }
    });
  });

  describe("onStateCreate", () => {
    it("is called for every state in the hierarchy", async () => {
      const p = new FsmProcess(nestedConfig);
      const created: string[] = [];
      p.onStateCreate((state) => {
        created.push(state.key);
      });
      await p.dispatch("");
      expect(created).toEqual(["Root", "Parent", "Child1"]);
    });

    it("is called for each new state on transition", async () => {
      const p = new FsmProcess(nestedConfig);
      const created: string[] = [];
      p.onStateCreate((state) => {
        created.push(state.key);
      });
      await p.dispatch("");
      await p.dispatch("next");
      expect(created).toEqual(["Root", "Parent", "Child1", "Child2"]);
    });
  });

  describe("onStateError", () => {
    it("process-level error handler catches state errors", async () => {
      const p = new FsmProcess(linearConfig);
      const errors: string[] = [];
      p._handleError = async () => {};
      p.onStateError((_state, error) => {
        errors.push((error as Error).message);
      });
      p.onStateCreate((state) => {
        if (state.key === "A") {
          state.onEnter(() => {
            throw new Error("state-error");
          });
        }
      });
      await p.dispatch("");
      expect(errors).toContain("state-error");
    });
  });

  describe("mask", () => {
    it("mask=STATUS_LEAF pauses at leaf states (default)", async () => {
      const p = new FsmProcess(nestedConfig);
      await p.dispatch("");
      expect(p.state?.key).toBe("Child1");
      expect(p.status).toBe(STATUS_LEAF);
    });

    it("custom mask changes pause behavior", async () => {
      const p = new FsmProcess(linearConfig);
      // Mask to pause at STATUS_FIRST (after first entry)
      p.mask = STATUS_FIRST;
      await p.dispatch("");
      // Should pause at root's first entry
      expect(p.state?.key).toBe("Root");
      expect(p.status).toBe(STATUS_FIRST);
    });
  });

  describe("bound methods", () => {
    it("dispatch works when detached", async () => {
      const p = new FsmProcess(linearConfig);
      const { dispatch } = p;
      await dispatch("");
      expect(p.state?.key).toBe("A");
    });

    it("dump works when detached", async () => {
      const p = new FsmProcess(linearConfig);
      await p.dispatch("");
      const { dump } = p;
      const d = await dump();
      expect(d.stack.length).toBe(2);
    });

    it("restore works when detached", async () => {
      const p = new FsmProcess(linearConfig);
      await p.dispatch("");
      const d = await p.dump();

      const p2 = new FsmProcess(linearConfig);
      const { restore } = p2;
      await restore(d);
      expect(p2.state?.key).toBe("A");
    });
  });
});
