import { runTrafficLight } from "../examples/01-traffic-light.ts";
import { runWizard } from "../examples/02-signup-wizard.ts";
import { parseCsvLine } from "../examples/03-csv-parser.ts";
import { runClient } from "../examples/04-async-reconnect.ts";
import { firstSession, secondSession } from "../examples/05-pause-and-resume.ts";
import { describe, expect, it } from "./deps.ts";

// Every example in `examples/` is executed here, so the docs cannot rot.

describe("examples/01 traffic light (FsmProcessSync)", () => {
  it("cycles colours, bubbles a fault, and ignores events with no rule", () => {
    const lines: string[] = [];
    expect(runTrafficLight((l) => lines.push(l))).toEqual([
      "Red",
      "Green",
      "Yellow",
      "Blinking",
      "Red",
      "Green",
    ]);
    expect(lines).toContain('(ignored "tick" in Blinking)');
    expect(lines).toContain('</Operating> <!-- event="fault" -->');
  });
});

describe("examples/02 sign-up wizard (startProcessSync)", () => {
  it("walks forward and back, saves via a generator state, and completes", () => {
    const r = runWizard([
      ["back"],
      ["next", ["name", "Ada"]],
      ["next", ["email", "ada@example.com"]],
      ["back"],
      ["next"],
      ["submit"],
    ]);
    expect(r.screens).toEqual([
      "What is your name?",
      "What is your name?", // "back" ignored on the first step
      "Hi Ada, your e-mail?",
      "Sign up Ada <ada@example.com>?",
      "Hi Ada, your e-mail?",
      "Sign up Ada <ada@example.com>?",
      "Welcome aboard!",
    ]);
    expect(r.states).toEqual(["Wizard", "Done"]);
    expect(r.saved).toEqual([{ name: "Ada", email: "ada@example.com" }]);
    expect(r.log).toEqual([
      "confirm screen shown",
      "confirm screen closed",
      "confirm screen shown",
      "confirm screen closed",
    ]);
  });

  it("'submit' only works from the Confirm step", () => {
    const r = runWizard([["submit"]]);
    expect(r.states).toEqual(["Wizard", "Form", "Name"]);
    expect(r.saved).toEqual([]);
  });

  it("'cancel' bubbles out of any nested step", () => {
    const r = runWizard([["next", ["name", "Bob"]], ["cancel"]]);
    expect(r.states).toEqual(["Wizard", "Cancelled"]);
    expect(r.screens[r.screens.length - 1]).toBe("Sign-up cancelled.");
    expect(r.answers).toEqual({});
  });
});

describe("examples/03 CSV parser (FsmProcessSync as a tokenizer)", () => {
  const cases: [string, string[]][] = [
    ["a,b,c", ["a", "b", "c"]],
    ["", [""]],
    [",", ["", ""]],
    ['"a,b",c', ["a,b", "c"]],
    ['"say ""hi"""', ['say "hi"']],
    ['x,"",y', ["x", "", "y"]],
    ['id,"name, full","say ""hi""",', ["id", "name, full", 'say "hi"', ""]],
  ];
  for (const [input, expected] of cases) {
    it(`parses ${JSON.stringify(input)}`, () => {
      expect(parseCsvLine(input)).toEqual(expected);
    });
  }

  it("rejects a quote inside an unquoted field", () => {
    expect(() => parseCsvLine('ab"c')).toThrow('Unexpected "\\"" at position 2');
  });

  it("rejects text after a closing quote", () => {
    expect(() => parseCsvLine('"a"b')).toThrow("position 3");
  });

  it("rejects an unterminated quoted field", () => {
    expect(() => parseCsvLine('"abc')).toThrow("Unterminated");
  });
});

describe("examples/04 reconnecting client (startProcess, async generators)", () => {
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it("retries, receives, reconnects after a drop, and finally gives up", async () => {
    const outcomes = [false, true, false, false, false];
    const inbox = ["hello"];
    const log = await runClient({
      maxAttempts: 3,
      connect: async () => {
        await tick();
        return outcomes.shift() ?? false;
      },
      receive: async () => {
        await tick();
        return inbox.shift();
      },
    });
    expect(log).toEqual([
      "connect #1",
      "connect #2",
      "online",
      "message: hello",
      "link dropped",
      "connect #1",
      "connect #2",
      "connect #3",
      "giving up",
    ]);
  });
});

describe("examples/05 pause and resume across engines", () => {
  it("snapshots a sync machine and finishes it on the async engine", async () => {
    const snapshot = firstSession(["book", "pen", "ink"]);
    expect(JSON.parse(snapshot).stack.map((s: { key: string }) => s.key)).toEqual([
      "Checkout",
      "Payment",
    ]);
    expect(await secondSession(snapshot)).toEqual({
      resumedAt: "Payment",
      now: "Receipt",
      order: { items: ["book", "pen", "ink"], paid: 30 },
    });
  });
});
