import {
  type FsmProcessDump,
  type FsmStateConfig,
  KEY_DISPATCH,
  KEY_EVENT,
  KEY_STATES,
  KEY_TERMINATE,
  type StageHandlerSync,
  startProcess,
  startProcessSync,
} from "../../src/index.ts";
import { describe, expect, it } from "../deps.ts";

// statewalker-fsm#23: one runner core for startProcess and startProcessSync.
// The same stage handlers, run on both runners, must leave the same transcript,
// the same context and the same handle behaviour.

const player: FsmStateConfig = {
  key: "Player",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "play", "Active"],
    ["*", "stop", "Idle"],
    ["Idle", "quit", ""],
  ],
  states: [
    {
      key: "Active",
      transitions: [
        ["", "*", "Playing"],
        ["Playing", "pause", "Paused"],
        ["Paused", "play", "Playing"],
        ["Playing", "end", "Done"],
      ],
    },
  ],
};

type Ctx = Record<string, unknown> & { log: string[] };
type Load = (key: string, event: string | undefined) => StageHandlerSync<Ctx>[];

/** Every state logs entry (with the context the runner bound) and exit. */
function tracing(extra: Record<string, StageHandlerSync<Ctx>> = {}): Load {
  return (key, event) => [
    (ctx) => {
      ctx.log.push(
        `enter ${key} by ${JSON.stringify(event)} states=${(ctx[KEY_STATES] as string[]).join("/")} event=${JSON.stringify(ctx[KEY_EVENT])}`,
      );
      return () => ctx.log.push(`exit ${key} states=${(ctx[KEY_STATES] as string[]).join("/")}`);
    },
    ...(extra[key] ? [extra[key]] : []),
  ];
}

type Run = {
  log: string[];
  states: unknown;
  event: unknown;
  dump?: FsmProcessDump;
};

type Script = (
  h: {
    dispatch(e: string): unknown;
    shutdown(): unknown;
    dump(): unknown;
    restore(d: FsmProcessDump): unknown;
  },
  ctx: Ctx,
) => (() => unknown)[];

async function runAsync(load: Load, script: Script): Promise<Run> {
  const ctx: Ctx = { log: [] };
  const handle = await startProcess(ctx, player, load);
  for (const call of script(handle, ctx)) await call();
  // Generator events are applied after `dispatch` resolves; let them land.
  for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0));
  return { log: ctx.log, states: ctx[KEY_STATES], event: ctx[KEY_EVENT] };
}

function runSync(load: Load, script: Script): Run {
  const ctx: Ctx = { log: [] };
  const handle = startProcessSync(ctx, player, load);
  for (const call of script(handle, ctx)) call();
  return { log: ctx.log, states: ctx[KEY_STATES], event: ctx[KEY_EVENT] };
}

async function both(load: Load, script: Script) {
  const a = await runAsync(load, script);
  const s = runSync(load, script);
  expect(s).toEqual(a);
  return a;
}

describe("runner conformance: startProcess and startProcessSync agree", () => {
  it("binds the context and runs cleanups in order", async () => {
    const r = await both(tracing(), (h) => [
      () => h.dispatch("play"),
      () => h.dispatch("pause"),
      () => h.dispatch("stop"),
    ]);
    expect(r.states).toEqual(["Player", "Idle"]);
    expect(r.log[0]).toContain("enter Player");
  });

  it("ignores an event with no transition (the guard)", async () => {
    const r = await both(tracing(), (h) => [() => h.dispatch("pause"), () => h.dispatch("play")]);
    expect(r.states).toEqual(["Player", "Active", "Playing"]);
  });

  it("applies yielded events once the machine has settled, in order", async () => {
    const r = await both(
      tracing({
        Playing: function* (ctx) {
          // Nothing after the yield: when the generator is resumed differs by
          // design (the async runner keeps pulling while the machine is busy).
          ctx.log.push("gen start");
          yield "pause";
        },
        Paused: function* (ctx) {
          if (ctx.log.includes("resumed once")) return;
          ctx.log.push("resumed once");
          yield "play";
        },
      }),
      (h) => [() => h.dispatch("play")],
    );
    expect(r.log).toContain("gen start");
  });

  it("terminates from a handler through KEY_TERMINATE", async () => {
    const r = await both(
      tracing({
        Paused: (ctx) => {
          (ctx[KEY_TERMINATE] as () => unknown)();
        },
      }),
      (h) => [() => h.dispatch("play"), () => h.dispatch("pause"), () => h.dispatch("play")],
    );
    expect(r.states).toEqual([]);
  });

  it("dispatches from a handler through KEY_DISPATCH", async () => {
    const r = await both(
      tracing({
        Idle: (ctx) => {
          if (ctx[KEY_EVENT] === "") void (ctx[KEY_DISPATCH] as (e: string) => unknown)("play");
        },
      }),
      () => [],
    );
    expect(r.states).toEqual(["Player", "Active", "Playing"]);
  });

  it("shuts down through the handle", async () => {
    const r = await both(tracing(), (h) => [() => h.dispatch("play"), () => h.shutdown()]);
    expect(r.states).toEqual([]);
  });

  it("restores a dump: unwinds the live stack first, rebinds the context, no load", async () => {
    const dumpCtx: Ctx = { log: [] };
    const source = startProcessSync(dumpCtx, player, tracing());
    source.dispatch("play");
    source.dispatch("pause");
    const dump = source.dump();
    const r = await both(tracing(), (h, ctx) => [
      () => h.dispatch("play"),
      () => ctx.log.push("-- restore"),
      () => h.restore(dump),
      () => h.dispatch("play"),
    ]);
    const after = r.log.slice(r.log.indexOf("-- restore"));
    expect(after.some((l) => l.startsWith("enter Paused"))).toBe(false);
    expect(r.states).toEqual(["Player", "Active", "Playing"]);
  });

  it("rejects a foreign dump before unwinding the live machine", async () => {
    const foreign: FsmProcessDump = { status: 4, stack: [{ key: "Other", data: {} }] };
    const ctxA: Ctx = { log: [] };
    const a = await startProcess(ctxA, player, tracing());
    await expect(a.restore(foreign)).rejects.toThrow(/root key "Other"/);
    const ctxS: Ctx = { log: [] };
    const s = startProcessSync(ctxS, player, tracing());
    expect(() => s.restore(foreign)).toThrow(/root key "Other"/);
    expect(ctxS.log).toEqual(ctxA.log);
    expect(ctxS[KEY_STATES]).toEqual(["Player", "Idle"]);
  });
});

describe("startProcessSync: an async load is reported (#23)", () => {
  it("reports an async load as misuse instead of failing to iterate it", async () => {
    const { vi } = await import("vitest");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const ctx: Ctx = { log: [] };
      startProcessSync(ctx, player, (() => Promise.resolve([])) as unknown as Load);
      const messages = spy.mock.calls.map((c) => String(c[0]));
      expect(messages.some((m) => m.includes("async load"))).toBe(true);
      expect(ctx[KEY_STATES]).toEqual(["Player", "Idle"]);
    } finally {
      spy.mockRestore();
    }
  });
});
