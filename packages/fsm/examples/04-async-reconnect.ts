/**
 * Example 4 — the async runner (`startProcess`) with self-driving states.
 *
 * A client connects to a flaky server: "Connecting" runs an async generator that
 * attempts the connection and yields "connected" or "failed"; "Backoff" waits and
 * yields "retry"; after too many attempts it yields "giveUp" and the machine ends.
 * "Connected" receives messages until the link drops, then reconnects.
 *
 * Generators are `return()`ed automatically when their state exits, so a pending
 * wait never fires into the wrong state.
 *
 * Run: node examples/04-async-reconnect.ts
 */
import { fileURLToPath } from "node:url";
import { type FsmStateConfig, type StageHandler, startProcess } from "../src/index.ts";

export const client: FsmStateConfig = {
  key: "Client",
  transitions: [
    ["", "*", "Connecting"],
    ["Connecting", "connected", "Connected"],
    ["Connecting", "failed", "Backoff"],
    ["Backoff", "retry", "Connecting"],
    ["Backoff", "giveUp", ""],
    ["Connected", "dropped", "Connecting"],
    ["*", "close", ""],
  ],
};

export type ClientContext = {
  /** Fake transport: resolves `true` when the attempt succeeds. */
  connect: (attempt: number) => Promise<boolean>;
  /** Fake inbound stream for one connection: resolves `undefined` when dropped. */
  receive: () => Promise<string | undefined>;
  maxAttempts: number;
  attempt: number;
  log: string[];
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const handlers: Record<string, StageHandler<ClientContext>> = {
  async *Connecting(ctx) {
    ctx.attempt++;
    ctx.log.push(`connect #${ctx.attempt}`);
    yield (await ctx.connect(ctx.attempt)) ? "connected" : "failed";
  },
  async *Backoff(ctx) {
    if (ctx.attempt >= ctx.maxAttempts) {
      ctx.log.push("giving up");
      yield "giveUp";
      return;
    }
    await sleep(ctx.attempt); // exponential in real life
    yield "retry";
  },
  async *Connected(ctx) {
    ctx.attempt = 0;
    ctx.log.push("online");
    for (let msg = await ctx.receive(); msg !== undefined; msg = await ctx.receive()) {
      ctx.log.push(`message: ${msg}`);
    }
    ctx.log.push("link dropped");
    yield "dropped";
  },
};

/** Start the client; resolves with the log once the machine has finished. */
export async function runClient(ctx: Omit<ClientContext, "attempt" | "log">) {
  const context: ClientContext = { ...ctx, attempt: 0, log: [] };
  let finish: () => void = () => {};
  const finished = new Promise<void>((r) => {
    finish = r;
  });
  await startProcess(context, client, (state) => {
    if (state === "Client") return [() => () => finish()];
    const handler = handlers[state];
    return handler ? [handler] : [];
  });
  await finished;
  return context.log;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // The server accepts the 3rd attempt, sends two messages, drops, then is gone.
  const outcomes = [false, false, true, false, false, false];
  const inbox = ["hello", "world"];
  const log = await runClient({
    maxAttempts: 3,
    connect: async () => {
      await sleep(1);
      return outcomes.shift() ?? false;
    },
    receive: async () => {
      await sleep(1);
      return inbox.shift();
    },
  });
  console.log(log.join("\n"));
}
