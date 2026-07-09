import {
  FsmProcess,
  type FsmStateConfig,
  getStateTransitions,
  isStateTransitionEnabled,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

// Root > Parent > Child. Both Root and Parent define a rule for "go":
// - Parent (inner): ["Child", "go", ""]  → exit-to-final (a FALSY target)
// - Root  (outer): ["Parent", "go", "Other"]
// The inner rule must mask the outer one — even though its target is "" — so the
// query agrees with what `dispatch` actually resolves.
const config: FsmStateConfig = {
  key: "Root",
  transitions: [
    ["", "*", "Parent"],
    ["Parent", "go", "Other"], // outer "go"
    ["Parent", "up", "Other"], // only the outer defines "up"
  ],
  states: [
    {
      key: "Parent",
      transitions: [
        ["", "*", "Child"],
        ["Child", "go", ""], // inner "go" → exit-to-final (falsy target)
      ],
      states: [{ key: "Child" }],
    },
    { key: "Other" },
  ],
};

async function atChild() {
  const process = new FsmProcess(config);
  await process.dispatch(""); // Root → Parent → Child
  expect(process.state?.key).toBe("Child");
  return process;
}

describe("getStateTransitions", () => {
  it("inner exit-to-final rule masks the outer rule for the same event", async () => {
    const process = await atChild();
    const go = getStateTransitions(process.state).filter(([, e]) => e === "go");
    // exactly one "go" — the inner exit — not the outer Parent→Other as well
    expect(go).toEqual([["Child", "go", ""]]);
  });

  it("surfaces an event only an outer state handles (bubbles up the chain)", async () => {
    const process = await atChild();
    const up = getStateTransitions(process.state).filter(([, e]) => e === "up");
    expect(up).toEqual([["Parent", "up", "Other"]]);
  });

  it("orders transitions outer→inner (root first)", async () => {
    const process = await atChild();
    const events = getStateTransitions(process.state).map(([, e]) => e);
    // "up" comes from Root (outer), "go" from Parent (inner)
    expect(events.indexOf("up")).toBeLessThan(events.indexOf("go"));
  });
});

describe("isStateTransitionEnabled", () => {
  it("is true for a handled event and false for an unhandled one", async () => {
    const process = await atChild();
    expect(isStateTransitionEnabled(process, "go")).toBe(true);
    expect(isStateTransitionEnabled(process, "up")).toBe(true);
    expect(isStateTransitionEnabled(process, "nope")).toBe(false);
  });
});
