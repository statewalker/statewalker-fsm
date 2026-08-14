import {
  type FsmStateConfig,
  KEY_DISPATCH,
  KEY_STATES,
  KEY_TERMINATE,
  startProcess,
} from "../../src/index.ts";
import { describe, expect, it } from "../deps.ts";

const config: FsmStateConfig = {
  key: "App",
  transitions: [
    ["", "", "Idle"],
    ["Idle", "go", "Work"],
    ["*", "stop", "Idle"],
  ],
};

const dispatchOf = (ctx: Record<string, unknown>) =>
  ctx[KEY_DISPATCH] as (event: string) => Promise<void>;

describe("startProcess — context bindings", () => {
  it("binds a working dispatch and terminate into the context", async () => {
    const ctx: Record<string, unknown> = {};
    await startProcess(ctx, config, () => []);
    expect(ctx[KEY_STATES]).toEqual(["App", "Idle"]);

    await dispatchOf(ctx)("go");
    expect(ctx[KEY_STATES]).toEqual(["App", "Work"]);

    await (ctx[KEY_TERMINATE] as () => Promise<void>)();
    expect(ctx[KEY_STATES]).toEqual([]); // stack fully unwound
  });
});

describe("startProcess — StageHandler return values", () => {
  it("registers a returned cleanup function as the state's onExit", async () => {
    let cleaned = 0;
    const ctx: Record<string, unknown> = {};
    await startProcess(ctx, config, (key) =>
      key === "Work"
        ? [
            () => () => {
              cleaned++;
            },
          ]
        : [],
    );
    await dispatchOf(ctx)("go"); // enter Work → handler returns cleanup
    expect(cleaned).toBe(0);
    await dispatchOf(ctx)("stop"); // exit Work → cleanup fires
    expect(cleaned).toBe(1);
  });

  it("surfaces an error thrown by a generator handler instead of swallowing it", async () => {
    const errors: unknown[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args[0]);
    };
    try {
      const ctx: Record<string, unknown> = {};
      await startProcess(
        ctx,
        { key: "App", transitions: [["", "", "Run"]] },
        (key) =>
          key === "Run"
            ? [
                async function* () {
                  yield "noop"; // harmless (no matching transition), then fail mid-iteration
                  throw new Error("BOOM");
                },
              ]
            : [],
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      console.error = origError;
    }
    expect(errors.some((e) => e instanceof Error && e.message === "BOOM")).toBe(
      true,
    );
  });
});

describe("startProcess — ProcessHandle dump/restore", () => {
  it("round-trips an advanced (non-initial) state through the handle", async () => {
    const ctxA: Record<string, unknown> = {};
    const handleA = await startProcess(ctxA, config, () => []);
    await dispatchOf(ctxA)("go");
    expect(ctxA[KEY_STATES]).toEqual(["App", "Work"]);
    const snapshot = await handleA.dump();

    const ctxB: Record<string, unknown> = {};
    const handleB = await startProcess(ctxB, config, () => []);
    await handleB.restore(snapshot);
    expect(ctxB[KEY_STATES]).toEqual(["App", "Work"]);
  });
});
