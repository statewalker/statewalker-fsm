import type { FsmStateConfig } from "../src/types.ts";
import { validate } from "../src/validate.ts";
import { describe, expect, it } from "./deps.ts";
import { sharedSubMachine } from "./fixtures.ts";

/**
 * State definition resolution is LEXICAL: the engine's `_newSubstate` walks
 * `state.parent` upward and takes the first `states[key]` it finds. A state
 * may therefore be referenced in a scope that does not define it.
 *
 * That is orthogonal to transition topology, which stays strictly local: a
 * transition may only connect direct sub-states of the state declaring it.
 */
describe("State definition resolution", () => {
  // ── S2: transition keys must RESOLVE, not be local ────────────────────

  describe("S2: resolvability", () => {
    it("should accept a target defined in an ancestor's states", () => {
      const result = validate(sharedSubMachine, { rules: ["S2"] });
      expect(result.issues).toHaveLength(0);
    });

    it("should accept a reference from a scope that declares no states of its own", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "Phase"]],
        states: [
          {
            key: "Phase",
            // no states: of its own — Shared resolves to Root.states.Shared
            transitions: [
              ["", "*", "Shared"],
              ["Shared", "done", ""],
            ],
          },
          { key: "Shared", events: { done: "When it completes" } },
        ],
      };
      const result = validate(config, { rules: ["S2"] });
      expect(result.issues).toHaveLength(0);
    });

    it("should report an error for a key defined in no ancestor", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          {
            key: "A",
            transitions: [
              ["", "*", "Ghost"],
              ["Ghost", "done", ""],
            ],
          },
        ],
      };
      const result = validate(config, { rules: ["S2"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe("S2");
      expect(result.errors[0].message).toContain("Ghost");
      expect(result.errors[0].message).toContain("does not resolve");
    });

    it("should report an unresolved key even when the scope declares no states", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "A"]],
        states: [
          {
            key: "A",
            transitions: [["Ghost", "done", ""]],
            events: { done: "When it completes" },
          },
        ],
      };
      const result = validate(config, { rules: ["S2"] });
      expect(result.valid).toBe(false);
      expect(result.errors.map((e) => e.message).join(" ")).toContain("Ghost");
    });

    it("should still accept the wildcard and exit pseudo-keys", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["*", "reset", "A"],
          ["A", "quit", ""],
        ],
        states: [{ key: "A", events: { quit: "When the user quits" } }],
      };
      const result = validate(config, { rules: ["S2"] });
      expect(result.issues).toHaveLength(0);
    });
  });

  // ── S9: shadowing is legal but worth flagging ─────────────────────────

  describe("S9: deliberate shadowing", () => {
    it("should warn when an inner scope redefines an ancestor's key", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [["", "*", "Phase"]],
        states: [
          {
            key: "Phase",
            transitions: [
              ["", "*", "Shared"],
              ["Shared", "done", ""],
            ],
            // shadows Root.states.Shared for this subtree only
            states: [{ key: "Shared", events: { done: "Inner variant" } }],
          },
          { key: "Shared", events: { done: "Outer variant" } },
        ],
      };
      const result = validate(config, { rules: ["S9"] });
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].rule).toBe("S9");
      expect(result.warnings[0].message).toContain("Shared");
      expect(result.warnings[0].message).toContain("shadows");
    });

    it("should stay silent when every key is distinct", () => {
      const result = validate(sharedSubMachine, { rules: ["S9"] });
      expect(result.issues).toHaveLength(0);
    });
  });

  // ── S4: reachability is checked at the INSTANTIATION site ─────────────

  describe("S4: reachability with shared definitions", () => {
    it("should not flag a definition that a descendant scope references", () => {
      const result = validate(sharedSubMachine, { rules: ["S4"] });
      expect(result.issues).toHaveLength(0);
    });

    it("should flag a definition that nothing references anywhere", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "A"],
          ["A", "done", ""],
        ],
        states: [
          { key: "A", events: { done: "When it completes" } },
          { key: "Orphan", events: { done: "Never reached" } },
        ],
      };
      const result = validate(config, { rules: ["S4"] });
      expect(result.valid).toBe(false);
      expect(result.errors[0].rule).toBe("S4");
      expect(result.errors[0].message).toContain("Orphan");
    });

    it("should flag a definition whose only referencing scope shadows it", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "Phase"],
          ["Phase", "done", ""],
        ],
        states: [
          {
            key: "Phase",
            transitions: [
              ["", "*", "Shared"],
              ["Shared", "done", ""],
            ],
            states: [{ key: "Shared", events: { done: "Inner variant" } }],
          },
          // referenced only from Phase, which defines its own Shared — so
          // this definition is instantiated nowhere
          { key: "Shared", events: { done: "Outer variant" } },
        ],
      };
      const result = validate(config, { rules: ["S4"] });
      expect(result.valid).toBe(false);
      expect(result.errors.map((e) => e.message).join(" ")).toContain("Shared");
    });
  });

  // ── M1: forward event coverage, per REFERENCING scope ─────────────────

  describe("M1: forward event coverage with shared definitions", () => {
    it("should accept events split across the scopes that reference the definition", () => {
      const result = validate(sharedSubMachine, { rules: ["M1"] });
      expect(result.issues).toHaveLength(0);
    });

    it("should warn about an event no referencing scope handles", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "Phase"],
          ["Phase", "done", ""],
        ],
        states: [
          {
            key: "Phase",
            transitions: [
              ["", "*", "Shared"],
              ["Shared", "done", ""],
            ],
          },
          {
            key: "Shared",
            events: {
              done: "When it completes",
              stalled: "When it never completes — handled by nobody",
            },
          },
        ],
      };
      const result = validate(config, { rules: ["M1"] });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].rule).toBe("M1");
      expect(result.warnings[0].message).toContain("stalled");
    });

    it("should warn about a referencing scope that handles none of the events", () => {
      const config: FsmStateConfig = {
        key: "Root",
        transitions: [
          ["", "*", "PhaseA"],
          ["PhaseA", "done", "PhaseB"],
          ["PhaseB", "done", ""],
        ],
        states: [
          {
            key: "PhaseA",
            transitions: [
              ["", "*", "Shared"],
              ["Shared", "done", ""],
            ],
          },
          {
            key: "PhaseB",
            // enters Shared but handles none of its events — the machine
            // can never leave it
            transitions: [["", "*", "Shared"]],
          },
          { key: "Shared", events: { done: "When it completes" } },
        ],
      };
      const result = validate(config, { rules: ["M1"] });
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.map((w) => w.message).join(" ")).toContain(
        "PhaseB",
      );
    });
  });
});
