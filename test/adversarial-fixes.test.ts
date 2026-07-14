import {
  FsmProcess,
  type FsmStateConfig,
  isStateTransitionEnabled,
  KEY_DISPATCH,
  KEY_STATES,
  startProcess,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

// #1 — the runner's guard must not drop an event that matches a wildcard (`*`) rule.
describe("wildcard-event guard (#1)", () => {
  const cfg: FsmStateConfig = {
    key: "Root",
    transitions: [
      ["", "*", "A"],
      ["A", "*", "B"],
      ["B", "*", ""],
    ],
  };

  it("isStateTransitionEnabled accepts a concrete event matching a wildcard rule", async () => {
    const p = new FsmProcess(cfg);
    await p.dispatch("");
    expect(p.state?.key).toBe("A");
    expect(isStateTransitionEnabled(p, "foo")).toBe(true);
  });

  it("startProcess advances on a concrete event that only matches a wildcard rule", async () => {
    const ctx: Record<string, unknown> = {};
    await startProcess(ctx, cfg, () => []);
    expect(ctx[KEY_STATES]).toEqual(["Root", "A"]);
    await (ctx[KEY_DISPATCH] as (e: string) => Promise<void>)("foo");
    expect(ctx[KEY_STATES]).toEqual(["Root", "B"]);
  });
});

// #2 — a throwing onStateError handler must not recurse forever.
describe("onStateError recursion (#2)", () => {
  it("does not stack-overflow when an onStateError handler itself throws", async () => {
    const cfg: FsmStateConfig = { key: "P", transitions: [["", "*", "X"]] };
    const p = new FsmProcess(cfg);
    let errCalls = 0;
    const origError = console.error;
    console.error = () => {}; // silence the expected error logging
    try {
      p.onStateCreate((s) => {
        s.onStateError(() => {
          errCalls++;
          throw new Error("boom-in-error-handler");
        });
        s.onEnter(() => {
          throw new Error("enter-fail");
        });
      });
      await p.dispatch(""); // must settle, not throw RangeError
    } finally {
      console.error = origError;
    }
    // before the fix this ran ~2469 times then RangeError; after fix: once per real error
    expect(errCalls).toBeLessThan(10);
  });
});

// #7 — two events dispatched during one settle cycle must both be honored, in order.
describe("re-entrant dispatch queue (#7)", () => {
  it("does not drop the earlier of two events queued during one settle", async () => {
    const cfg: FsmStateConfig = {
      key: "Root",
      transitions: [["", "*", "Parent"]],
      states: [
        {
          key: "Parent",
          transitions: [
            ["", "*", "Child1"],
            ["Child1", "p", "P1"],
            ["P1", "c", "C1"],
            ["Child1", "c", "C1"],
          ],
          states: [{ key: "Child1" }, { key: "P1" }, { key: "C1" }],
        },
      ],
    };
    const entered: string[] = [];
    const p = new FsmProcess(cfg);
    p.onStateCreate((s) => {
      s.onEnter(() => {
        entered.push(s.key);
        if (s.key === "Parent") p.dispatch("p");
        if (s.key === "Child1") p.dispatch("c");
      });
    });
    await p.dispatch("");
    // both queued events must run in order: Child1 --p--> P1 --c--> C1
    expect(entered).toContain("P1");
    expect(entered.indexOf("P1")).toBeLessThan(entered.indexOf("C1"));
  });
});
