/**
 * Example 7 — write the behaviour once, run it on either engine.
 *
 * Synchronous stage handlers (`StageHandlerSync`) are also valid async
 * `StageHandler`s, so one handler set serves both runners: `startProcessSync`
 * in a hot loop or a test, `startProcess` where other states need `await`.
 * Both runners walk the same traversal, so they produce the same transcript.
 *
 * The machine is a coin-operated turnstile with a maintenance mode.
 *
 * Run: node examples/07-one-machine-two-engines.ts
 */
import { fileURLToPath } from "node:url";
import {
  type FsmStateConfig,
  type StageHandlerSync,
  startProcess,
  startProcessSync,
} from "../src/index.ts";

export const turnstile: FsmStateConfig = {
  key: "Turnstile",
  transitions: [
    ["", "*", "InService"],
    ["InService", "service", "Maintenance"],
    ["Maintenance", "done", "InService"],
  ],
  states: [
    {
      key: "InService",
      transitions: [
        ["", "*", "Locked"],
        ["Locked", "coin", "Unlocked"],
        ["Unlocked", "push", "Locked"],
        ["Unlocked", "coin", "Unlocked"], // extra coins are kept
      ],
    },
  ],
};

export type TurnstileContext = { coins: number; log: string[] };

/** One handler set — usable by both `startProcessSync` and `startProcess`. */
export const turnstileHandlers: Record<string, StageHandlerSync<TurnstileContext>> = {
  Locked: (ctx) => {
    ctx.log.push("locked");
  },
  Unlocked: (ctx) => {
    ctx.coins++;
    ctx.log.push(`unlocked (coins=${ctx.coins})`);
    return () => {
      ctx.log.push("left Unlocked");
    };
  },
  Maintenance: (ctx) => {
    ctx.log.push(`maintenance: emptied ${ctx.coins} coins`);
    ctx.coins = 0;
  },
};

const load = (state: string) => {
  const handler = turnstileHandlers[state];
  return handler ? [handler] : [];
};

/** Run `events` on the sync runner. */
export function runSync(events: string[]): TurnstileContext {
  const ctx: TurnstileContext = { coins: 0, log: [] };
  const handle = startProcessSync(ctx, turnstile, load);
  for (const event of events) {
    handle.dispatch(event);
  }
  return ctx;
}

/** Run the same `events` on the async runner. */
export async function runAsync(events: string[]): Promise<TurnstileContext> {
  const ctx: TurnstileContext = { coins: 0, log: [] };
  const handle = await startProcess(ctx, turnstile, load);
  for (const event of events) {
    await handle.dispatch(event);
  }
  return ctx;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const events = ["push", "coin", "coin", "push", "service", "coin", "done", "coin", "push"];
  const sync = runSync(events);
  const async = await runAsync(events);
  console.log(sync.log.join("\n"));
  console.log("same transcript on both engines:", JSON.stringify(sync) === JSON.stringify(async));
}
