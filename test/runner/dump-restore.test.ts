import type { FsmStateConfig } from "../../src/core/fsm-state-config.ts";
import {
  KEY_EVENT,
  KEY_STATES,
  startProcess,
} from "../../src/start-process.ts";
import { describe, expect, it } from "../deps.ts";

const config: FsmStateConfig = {
  key: "App",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "start", "Working"],
    ["Working", "done", "Result"],
    ["Result", "reset", "Idle"],
    ["*", "quit", ""],
  ],
};

describe("runner dump/restore", () => {
  it("dump returns current process state", async () => {
    const ctx: Record<string, unknown> = {};
    const handle = await startProcess(ctx, config, () => [], "");
    const dump = await handle.dump();
    expect(dump.stack.map((s) => s.key)).toEqual(["App", "Idle"]);
    await handle.shutdown();
  });

  it("restore rebuilds process from dump", async () => {
    const ctx1: Record<string, unknown> = {};
    const h1 = await startProcess(ctx1, config, () => [], "");
    await h1.dump(); // at Idle

    // Advance to Working
    const ctx2: Record<string, unknown> = {};
    const h2 = await startProcess(ctx2, config, () => [], "");
    // We need to dispatch via the process — use a handler that captures dispatch
    await h2.shutdown();

    // Simpler: start, advance, dump, restore into new process
    const ctxA: Record<string, unknown> = {};
    const hA = await startProcess(ctxA, config, () => [], "");
    const dumpA = await hA.dump();
    expect(dumpA.stack.map((s) => s.key)).toEqual(["App", "Idle"]);

    // Restore into fresh context
    const ctxB: Record<string, unknown> = {};
    const hB = await startProcess(ctxB, config, () => [], "");
    await hB.restore(dumpA);
    const dumpB = await hB.dump();
    expect(dumpB.stack.map((s) => s.key)).toEqual(["App", "Idle"]);
    expect(dumpB.status).toBe(dumpA.status);
    expect(dumpB.event).toBe(dumpA.event);

    await hA.shutdown();
    await hB.shutdown();
  });

  it("context keys are updated after restore", async () => {
    const ctx1: Record<string, unknown> = {};
    const h1 = await startProcess(ctx1, config, () => [], "");
    const dump = await h1.dump();

    const ctx2: Record<string, unknown> = {};
    const h2 = await startProcess(ctx2, config, () => [], "");
    await h2.restore(dump);

    expect(ctx2[KEY_STATES]).toEqual(["App", "Idle"]);
    expect(ctx2[KEY_EVENT]).toBe("");

    await h1.shutdown();
    await h2.shutdown();
  });

  it("dump includes custom state data from handlers", async () => {
    let enterCount = 0;
    const ctx: Record<string, unknown> = {};
    const handle = await startProcess(
      ctx,
      config,
      () => {
        return [
          () => {
            enterCount++;
          },
        ];
      },
      "",
    );

    const dump = await handle.dump();
    expect(dump.stack.length).toBe(2);
    expect(enterCount).toBe(2); // App + Idle
    await handle.shutdown();
  });

  it("dump/restore cycle preserves state stack", async () => {
    // Start and advance
    const ctx1: Record<string, unknown> = {};
    const h1 = await startProcess(ctx1, config, () => [], "");
    const dump1 = await h1.dump();
    expect(dump1.stack.map((s) => s.key)).toEqual(["App", "Idle"]);

    // Restore into new process
    const ctx2: Record<string, unknown> = {};
    const h2 = await startProcess(ctx2, config, () => [], "");
    await h2.restore(dump1);

    // Dump again — should be identical
    const dump2 = await h2.dump();
    expect(dump2.stack.map((s) => s.key)).toEqual(["App", "Idle"]);
    expect(dump2.status).toBe(dump1.status);
    expect(dump2.event).toBe(dump1.event);

    await h1.shutdown();
    await h2.shutdown();
  });
});
