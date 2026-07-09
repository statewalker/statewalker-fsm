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

  it("dump/restore cycle preserves state stack", async () => {
    // Start (rests at the initial state); advanced-state round-trips through the
    // handle are covered in start-process.test.ts.
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
