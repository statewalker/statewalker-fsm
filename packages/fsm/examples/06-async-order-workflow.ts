/**
 * Example 6 — the low-level async engine (`FsmProcess`) running a workflow.
 *
 * An order goes Validate → Charge → Ship. Each step's `onEnter` handler is
 * `async` (it calls a service) and then dispatches the outcome. Dispatching from
 * inside a handler is queued and applied once the current step settles, so the
 * top-level `await fsm.dispatch("")` resolves only after the whole chain has
 * run.
 *
 * A failing service call does not reject `dispatch`: the error goes to the
 * process's `onStateError` handler, which turns it into a "failed" event.
 *
 * Run: node examples/06-async-order-workflow.ts
 */
import { fileURLToPath } from "node:url";
import {
  FsmProcess,
  type FsmState,
  type FsmStateConfig,
  setProcessPrinter,
  setProcessTracer,
} from "../src/index.ts";

export const orderWorkflow: FsmStateConfig = {
  key: "Order",
  transitions: [
    ["", "*", "Validate"],
    ["Validate", "ok", "Charge"],
    ["Validate", "invalid", "Rejected"],
    ["Charge", "ok", "Ship"],
    ["Ship", "ok", "Done"],
    ["*", "failed", "Rejected"],
  ],
};

export type OrderServices = {
  validate(order: OrderData): Promise<boolean>;
  charge(order: OrderData): Promise<string>; // returns a payment id, or throws
  ship(order: OrderData): Promise<string>; // returns a tracking number
};

export type OrderData = { id: string; amount: number; paymentId?: string; tracking?: string };

export async function runOrder(order: OrderData, services: OrderServices) {
  const trace: string[] = [];
  const errors: string[] = [];
  const fsm = new FsmProcess(orderWorkflow);
  setProcessPrinter(fsm, { prefix: `[${order.id}]`, print: (...a) => trace.push(a.join("")) });
  setProcessTracer(fsm);

  const steps: Record<string, (state: FsmState) => Promise<void>> = {
    Validate: async () => {
      fsm.dispatch((await services.validate(order)) ? "ok" : "invalid");
    },
    Charge: async () => {
      order.paymentId = await services.charge(order);
      fsm.dispatch("ok");
    },
    Ship: async () => {
      order.tracking = await services.ship(order);
      fsm.dispatch("ok");
    },
  };
  fsm.onStateCreate((state) => {
    const step = steps[state.key];
    if (step) state.onEnter(step);
  });
  fsm.onStateError((state, error) => {
    errors.push(`${state.key}: ${(error as Error).message}`);
    fsm.dispatch("failed");
  });

  const origError = console.error; // errors are also logged; keep the demo quiet
  console.error = () => {};
  try {
    await fsm.dispatch(""); // resolves once the machine rests in Done or Rejected
  } finally {
    console.error = origError;
  }
  return { outcome: fsm.state?.key, order, errors, trace };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const delay = <T>(value: T) => new Promise<T>((r) => setTimeout(() => r(value), 5));
  const services: OrderServices = {
    validate: (o) => delay(o.amount > 0),
    charge: async (o) => {
      if (o.amount > 100) throw new Error("card declined");
      return delay(`pay-${o.id}`);
    },
    ship: (o) => delay(`trk-${o.id}`),
  };
  for (const order of [
    { id: "A1", amount: 30 },
    { id: "B2", amount: 500 },
    { id: "C3", amount: 0 },
  ]) {
    const { outcome, errors, trace } = await runOrder(order, services);
    console.log(trace.join("\n"));
    console.log(`→ ${order.id}: ${outcome}`, errors.length ? errors : "", "\n");
  }
}
