import { runTrafficLight } from "../examples/01-traffic-light.ts";
import { runWizard } from "../examples/02-signup-wizard.ts";
import { parseCsvLine } from "../examples/03-csv-parser.ts";
import { runClient } from "../examples/04-async-reconnect.ts";
import { firstSession, secondSession } from "../examples/05-pause-and-resume.ts";
import { type OrderServices, runOrder } from "../examples/06-async-order-workflow.ts";
import { runAsync, runSync } from "../examples/07-one-machine-two-engines.ts";
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

describe("examples/06 order workflow (FsmProcess, async handlers)", () => {
  const services: OrderServices = {
    validate: async (o) => o.amount > 0,
    charge: async (o) => {
      await new Promise((r) => setTimeout(r, 1));
      if (o.amount > 100) throw new Error("card declined");
      return `pay-${o.id}`;
    },
    ship: async (o) => `trk-${o.id}`,
  };

  it("one top-level dispatch runs the whole async chain", async () => {
    const r = await runOrder({ id: "A1", amount: 30 }, services);
    expect(r.outcome).toBe("Done");
    expect(r.order).toEqual({ id: "A1", amount: 30, paymentId: "pay-A1", tracking: "trk-A1" });
    expect(r.errors).toEqual([]);
    expect(r.trace[0]).toBe('[A1]<Order event="">');
    expect(r.trace).toContain('[A1]  <Done event="ok">');
  });

  it("a throwing step becomes a 'failed' event via onStateError", async () => {
    const r = await runOrder({ id: "B2", amount: 500 }, services);
    expect(r.outcome).toBe("Rejected");
    expect(r.errors).toEqual(["Charge: card declined"]);
    expect(r.order.tracking).toBeUndefined();
  });

  it("a negative validation goes straight to Rejected", async () => {
    const r = await runOrder({ id: "C3", amount: 0 }, services);
    expect(r.outcome).toBe("Rejected");
    expect(r.order.paymentId).toBeUndefined();
  });
});

describe("examples/07 one handler set on both runners", () => {
  const events = ["push", "coin", "coin", "push", "service", "coin", "done", "coin", "push"];

  it("produces the same transcript on startProcessSync and startProcess", async () => {
    const sync = runSync(events);
    expect(sync.log).toEqual([
      "locked",
      "unlocked (coins=1)",
      "left Unlocked",
      "unlocked (coins=2)",
      "left Unlocked",
      "locked",
      "maintenance: emptied 2 coins",
      "locked",
      "unlocked (coins=1)",
      "left Unlocked",
      "locked",
    ]);
    const async = await runAsync(events);
    expect({ coins: async.coins, log: async.log }).toEqual({ coins: sync.coins, log: sync.log });
  });
});
