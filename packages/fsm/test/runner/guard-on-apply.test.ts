// Regression tests for statewalker/statewalker-fsm#24: the runners' dispatch guard
// must be checked when a queued event is applied, not when it is queued.
import {
  type FsmStateConfig,
  KEY_DISPATCH,
  KEY_STATES,
  startProcess,
  startProcessSync,
} from "../../src/index.ts";
import { describe, expect, it } from "../deps.ts";

const config: FsmStateConfig = {
  key: "Player",
  transitions: [
    ["", "", "Idle"],
    ["Idle", "play", "Active"],
    ["*", "stop", "Idle"],
  ],
  states: [
    { key: "Idle" },
    {
      key: "Active",
      transitions: [
        ["", "*", "Playing"],
        ["Playing", "pause", "Paused"],
        ["Paused", "play", "Playing"],
      ],
      states: [{ key: "Playing" }, { key: "Paused" }],
    },
  ],
};

describe("runner guard is applied when a queued event is processed (#24)", () => {
  it("sync: a second queued `play` does not unwind the machine", () => {
    const ctx: Record<string, unknown> = {};
    startProcessSync(ctx, config, (key) =>
      key === "Idle"
        ? [
            (c) => {
              const dispatch = c[KEY_DISPATCH] as (e: string) => void;
              dispatch("play");
              dispatch("play");
            },
          ]
        : [],
    );
    expect(ctx[KEY_STATES]).toEqual(["Player", "Active", "Playing"]);
  });

  it("async: two un-awaited `play` dispatches do not unwind the machine", async () => {
    const ctx: Record<string, unknown> = {};
    const h = await startProcess(ctx, config, () => []);
    const a = h.dispatch("play");
    const b = h.dispatch("play");
    await Promise.all([a, b]);
    expect(ctx[KEY_STATES]).toEqual(["Player", "Active", "Playing"]);
  });

  it("async: an event arriving while an async onEnter awaits is checked where it lands", async () => {
    const ctx: Record<string, unknown> = {};
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const h = await startProcess(ctx, config, (key) =>
      key === "Playing" ? [async () => void (await gate)] : [],
    );
    const a = h.dispatch("play");
    const b = h.dispatch("play"); // arrives while Playing's onEnter awaits
    release();
    await Promise.all([a, b]);
    expect(ctx[KEY_STATES]).toEqual(["Player", "Active", "Playing"]);
  });

  it("sync: `pause` dispatched from Active's own handler applies once Playing is entered", () => {
    const ctx: Record<string, unknown> = {};
    const h = startProcessSync(ctx, config, (key) =>
      key === "Active" ? [(c) => (c[KEY_DISPATCH] as (e: string) => void)("pause")] : [],
    );
    h.dispatch("play");
    expect(ctx[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
  });

  it("async: `pause` dispatched from Active's own handler applies once Playing is entered", async () => {
    const ctx: Record<string, unknown> = {};
    const h = await startProcess(ctx, config, (key) =>
      key === "Active"
        ? [(c) => void (c[KEY_DISPATCH] as (e: string) => Promise<void>)("pause")]
        : [],
    );
    await h.dispatch("play");
    expect(ctx[KEY_STATES]).toEqual(["Player", "Active", "Paused"]);
  });

  it("an event with no rule is still ignored when idle", async () => {
    const ctx: Record<string, unknown> = {};
    const h = await startProcess(ctx, config, () => []);
    await h.dispatch("bogus");
    expect(ctx[KEY_STATES]).toEqual(["Player", "Idle"]);
    const sctx: Record<string, unknown> = {};
    const s = startProcessSync(sctx, config, () => []);
    s.dispatch("bogus");
    expect(sctx[KEY_STATES]).toEqual(["Player", "Idle"]);
  });
});
