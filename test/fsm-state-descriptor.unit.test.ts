import {
  type FsmStateConfig,
  FsmStateDescriptor,
  STATE_FINAL,
} from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

describe("FsmStateDescriptor", () => {
  it("builds from empty config", () => {
    const d = FsmStateDescriptor.build({ key: "Empty" });
    expect(d.transitions).toEqual({});
    expect(d.states).toEqual({});
  });

  it("builds transitions index from config", () => {
    const d = FsmStateDescriptor.build({
      key: "Root",
      transitions: [
        ["A", "go", "B"],
        ["B", "back", "A"],
      ],
    });
    expect(d.transitions).toEqual({
      A: { go: "B" },
      B: { back: "A" },
    });
  });

  it("builds nested state descriptors", () => {
    const d = FsmStateDescriptor.build({
      key: "Root",
      states: [
        {
          key: "Child",
          transitions: [["", "*", "Leaf"]],
        },
      ],
    });
    expect(d.states.Child).toBeDefined();
    expect(d.states.Child.transitions).toEqual({ "": { "*": "Leaf" } });
  });

  it("deeply nested states are built recursively", () => {
    const d = FsmStateDescriptor.build({
      key: "Root",
      states: [
        {
          key: "L1",
          states: [
            {
              key: "L2",
              transitions: [["", "*", "Leaf"]],
            },
          ],
        },
      ],
    });
    expect(d.states.L1.states.L2).toBeDefined();
    expect(d.states.L1.states.L2.transitions).toEqual({
      "": { "*": "Leaf" },
    });
  });

  describe("getTargetStateKey", () => {
    const config: FsmStateConfig = {
      key: "Test",
      transitions: [
        ["A", "go", "B"],
        ["A", "stay", "A"],
        ["*", "reset", "A"],
        ["B", "*", "C"],
        ["*", "*", "Default"],
      ],
    };
    const d = FsmStateDescriptor.build(config);

    it("exact state + exact event match", () => {
      expect(d.getTargetStateKey("A", "go")).toBe("B");
    });

    it("wildcard state + exact event match", () => {
      expect(d.getTargetStateKey("Unknown", "reset")).toBe("A");
    });

    it("exact state + wildcard event match", () => {
      expect(d.getTargetStateKey("B", "anything")).toBe("C");
    });

    it("wildcard state + wildcard event (fallback)", () => {
      expect(d.getTargetStateKey("Unknown", "unknown")).toBe("Default");
    });

    it("priority: exact > wildcard-state > wildcard-event > wildcard-both", () => {
      // A + go → B (exact match, not Default)
      expect(d.getTargetStateKey("A", "go")).toBe("B");
      // A + reset → A (wildcard-state match "* reset → A")
      // But A + stay → A is exact, so for "reset" from A: wildcard state wins
      expect(d.getTargetStateKey("A", "reset")).toBe("A");
      // Wait, actually the priority is: [A, reset], [*, reset], [A, *], [*, *]
      // [A, reset] → not in transitions.A (which has "go" and "stay")
      // [*, reset] → transitions["*"]["reset"] = "A" ← match
      // So result is "A"
    });

    it("returns STATE_FINAL when no transition matches", () => {
      const d2 = FsmStateDescriptor.build({
        key: "Test",
        transitions: [["A", "go", "B"]],
      });
      expect(d2.getTargetStateKey("X", "nope")).toBe(STATE_FINAL);
    });

    it("returns empty string (STATE_FINAL) for explicit exit transitions", () => {
      const d2 = FsmStateDescriptor.build({
        key: "Test",
        transitions: [["A", "done", ""]],
      });
      expect(d2.getTargetStateKey("A", "done")).toBe("");
    });
  });
});
