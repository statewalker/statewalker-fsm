/**
 * Example 1 — the low-level sync engine (`FsmProcessSync`).
 *
 * A traffic light cycles Red → Green → Yellow on "tick". The cycle lives inside a
 * composite "Operating" state, so a "fault" raised from *any* colour bubbles up to
 * the root's rule and switches to "Blinking"; "repair" goes back to operating
 * (which re-enters its initial child, Red).
 *
 * Pitfall shown here: with the raw engine an event that matches no rule exits
 * the current state, then its parent, … and finishes the machine. "tick" has no
 * rule in Blinking, so events are guarded with `isStateTransitionEnabled`
 * (the runners `startProcess` / `startProcessSync` do this for you).
 *
 * Run: node examples/01-traffic-light.ts
 */
import { fileURLToPath } from "node:url";
import {
  FsmProcessSync,
  type FsmStateConfig,
  isStateTransitionEnabled,
  setProcessTracer,
} from "../src/index.ts";

export const trafficLight: FsmStateConfig = {
  key: "TrafficLight",
  transitions: [
    ["", "*", "Operating"],
    ["Operating", "fault", "Blinking"],
    ["Blinking", "repair", "Operating"],
  ],
  states: [
    {
      key: "Operating",
      transitions: [
        ["", "*", "Red"],
        ["Red", "tick", "Green"],
        ["Green", "tick", "Yellow"],
        ["Yellow", "tick", "Red"],
      ],
    },
  ],
};

export function runTrafficLight(print: (line: string) => void = console.log): string[] {
  const lamps: string[] = [];
  const fsm = new FsmProcessSync(trafficLight);

  // Behaviour is attached per state as it is created.
  fsm.onStateCreate((state) => {
    if (["Red", "Green", "Yellow", "Blinking"].includes(state.key)) {
      state.onEnter(() => lamps.push(state.key));
    }
  });
  // Optional: an indented enter/exit trace of everything the machine does.
  setProcessTracer(fsm, (...args) => print(args.join("")));

  // Every call has fully settled when it returns — no awaits needed.
  fsm.dispatch(""); // enter the initial state
  for (const event of ["tick", "tick", "fault", "tick", "repair", "tick"]) {
    if (isStateTransitionEnabled(fsm, event)) fsm.dispatch(event);
    else print(`(ignored "${event}" in ${fsm.state?.key})`);
  }
  return lamps;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log("lamps:", runTrafficLight().join(" → "));
}
