/**
 * Example 5 — pausing a machine, persisting it, and resuming it elsewhere.
 *
 * A checkout flow runs on the sync engine in one "session"; per-state data is
 * recorded with `dump` hooks; the snapshot goes through JSON (a database, a
 * cookie, a message queue…). A brand-new *async* `FsmProcess` — e.g. on a
 * server — restores it with its `restore` hooks and finishes the flow. Dumps are
 * plain data and interchangeable between `FsmProcessSync` and `FsmProcess`.
 *
 * Run: node examples/05-pause-and-resume.ts
 */
import { fileURLToPath } from "node:url";
import {
  FsmProcess,
  type FsmProcessDump,
  FsmProcessSync,
  type FsmState,
  type FsmStateConfig,
  type FsmStateSync,
} from "../src/index.ts";

export const checkout: FsmStateConfig = {
  key: "Checkout",
  transitions: [
    ["", "*", "Cart"],
    ["Cart", "checkout", "Payment"],
    ["Payment", "paid", "Receipt"],
  ],
  states: [
    {
      key: "Cart",
      transitions: [
        ["", "*", "Browsing"],
        ["Browsing", "add", "Browsing"],
      ],
    },
  ],
};

type Order = { items: string[]; paid?: number };

/** Shared by both engines: persist the order in the root state's snapshot data. */
function persistOrder(state: FsmState | FsmStateSync, order: Order) {
  if (state.key !== "Checkout") return;
  state.dump((_, data) => {
    data.order = structuredClone(order);
  });
  state.restore((_, data) => {
    Object.assign(order, data.order as Order);
  });
}

/** Session 1 (sync, e.g. in the browser): fill the cart, start paying, snapshot. */
export function firstSession(items: string[]): string {
  const order: Order = { items: [] };
  let item = "";
  const fsm = new FsmProcessSync(checkout);
  fsm.onStateCreate((s) => {
    persistOrder(s, order);
    // "Browsing --add--> Browsing" re-enters the state: record the item each time.
    if (s.key === "Browsing") {
      s.onEnter(() => {
        if (fsm.event === "add") order.items.push(item);
      });
    }
  });
  fsm.dispatch("");
  for (item of items) fsm.dispatch("add");
  fsm.dispatch("checkout");
  return JSON.stringify(fsm.dump());
}

/** Session 2 (async, e.g. on the server): restore, complete payment, report. */
export async function secondSession(snapshot: string) {
  const order: Order = { items: [] };
  const fsm = new FsmProcess(checkout);
  fsm.onStateCreate((s) => {
    persistOrder(s, order);
    if (s.key === "Payment") {
      s.onExit(async () => {
        order.paid = order.items.length * 10;
      });
    }
  });
  await fsm.restore(JSON.parse(snapshot) as FsmProcessDump);
  const resumedAt = fsm.state?.key;
  await fsm.dispatch("paid");
  return { resumedAt, now: fsm.state?.key, order };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const snapshot = firstSession(["book", "pen"]);
  console.log("snapshot:", snapshot);
  console.log("resumed:", await secondSession(snapshot));
}
