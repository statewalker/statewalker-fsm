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
// An exit-to-final rule does not mask the outer one: Child exits, the event bubbles,
// and Root's rule moves Parent to Other. The query must agree with `dispatch`.
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
  it("an inner exit-to-final rule does not mask the outer rule: the event bubbles (#35)", async () => {
    const process = await atChild();
    const go = getStateTransitions(process.state).filter(([, e]) => e === "go");
    expect(go).toEqual([
      ["Parent", "go", "Other"],
      ["Child", "go", ""],
    ]);
    await process.dispatch("go");
    expect(process.state?.key).toBe("Other");
  });

  it("an inner wildcard-event rule hides every outer rule (#35)", async () => {
    const process = new FsmProcess({
      key: "Player",
      transitions: [
        ["", "*", "Active"],
        ["*", "stop", "Idle"],
      ],
      states: [
        {
          key: "Active",
          transitions: [
            ["", "*", "Playing"],
            ["Playing", "*", "Paused"],
          ],
        },
        { key: "Idle" },
      ],
    });
    await process.dispatch("");
    expect(process.state?.key).toBe("Playing");
    expect(getStateTransitions(process.state)).toEqual([["Playing", "*", "Paused"]]);
    await process.dispatch("stop");
    expect(process.state?.key).toBe("Paused");
  });

  it("an inner wildcard-event exit-to-final rule hides nothing (#35)", async () => {
    const process = new FsmProcess({
      key: "Player",
      transitions: [
        ["", "*", "Active"],
        ["*", "stop", "Idle"],
      ],
      states: [
        {
          key: "Active",
          transitions: [
            ["", "*", "Playing"],
            ["Playing", "*", ""],
          ],
        },
        { key: "Idle" },
      ],
    });
    await process.dispatch("");
    expect(getStateTransitions(process.state)).toEqual([
      ["Active", "stop", "Idle"],
      ["Playing", "*", ""],
    ]);
    await process.dispatch("stop");
    expect(process.state?.key).toBe("Idle");
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
