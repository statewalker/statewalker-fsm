/**
 * Example 2 — the sync runner (`startProcessSync`) driving a UI wizard.
 *
 * Shows:
 * - per-state handlers returned from one `load` callback,
 * - a cleanup function returned by a handler (runs when the state exits),
 * - a generator-driven state: "Saving" persists the answers and yields "saved",
 * - event bubbling: "saved" makes Saving exit the Form, and the root's
 *   `Form --saved--> Done` rule fires; "cancel" from any step bubbles to
 *   `* --cancel--> Cancelled`,
 * - the guarded `dispatch`: events with no transition in the current state
 *   (e.g. "back" on the first step) are ignored instead of unwinding the machine.
 *
 * Design note: an event that bubbles is accepted from *every* nested step. Had
 * the root used `Form --submit--> Done`, a "submit" on the first step would exit
 * the whole form. Bubbling only an internal event ("saved") avoids that.
 *
 * Run: node examples/02-signup-wizard.ts
 */
import { fileURLToPath } from "node:url";
import {
  type FsmStateConfig,
  KEY_STATES,
  type StageHandlerSync,
  startProcessSync,
} from "../src/index.ts";

export const wizard: FsmStateConfig = {
  key: "Wizard",
  transitions: [
    ["", "*", "Form"],
    ["Form", "saved", "Done"],
    ["*", "cancel", "Cancelled"],
  ],
  states: [
    {
      key: "Form",
      transitions: [
        ["", "*", "Name"],
        ["Name", "next", "Email"],
        ["Email", "back", "Name"],
        ["Email", "next", "Confirm"],
        ["Confirm", "back", "Email"],
        ["Confirm", "submit", "Saving"],
        ["Saving", "saved", ""],
      ],
    },
  ],
};

export type WizardContext = {
  screen?: string;
  answers: Record<string, string>;
  saved: Record<string, string>[];
  log: string[];
};

const screens: Record<string, StageHandlerSync<WizardContext>> = {
  Name: (ctx) => {
    ctx.screen = "What is your name?";
  },
  Email: (ctx) => {
    ctx.screen = `Hi ${ctx.answers.name ?? "there"}, your e-mail?`;
  },
  Confirm: (ctx) => {
    ctx.screen = `Sign up ${ctx.answers.name} <${ctx.answers.email}>?`;
    ctx.log.push("confirm screen shown");
    return () => ctx.log.push("confirm screen closed");
  },
  *Saving(ctx) {
    ctx.saved.push({ ...ctx.answers });
    yield "saved";
  },
  Done: (ctx) => {
    ctx.screen = "Welcome aboard!";
  },
  Cancelled: (ctx) => {
    ctx.screen = "Sign-up cancelled.";
    ctx.answers = {};
  },
};

export function runWizard(script: [event: string, answer?: [string, string]][]) {
  const ctx: WizardContext = { answers: {}, saved: [], log: [] };
  const handle = startProcessSync(ctx, wizard, (state) => {
    const handler = screens[state];
    return handler ? [handler] : [];
  });
  const screensShown = [ctx.screen];
  for (const [event, answer] of script) {
    if (answer) ctx.answers[answer[0]] = answer[1];
    handle.dispatch(event);
    screensShown.push(ctx.screen);
  }
  return {
    screens: screensShown,
    states: (ctx as Record<string, unknown>)[KEY_STATES] as string[],
    answers: ctx.answers,
    saved: ctx.saved,
    log: ctx.log,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = runWizard([
    ["back"], // ignored: no "back" from the first step
    ["next", ["name", "Ada"]],
    ["next", ["email", "ada@example.com"]],
    ["back"],
    ["next"],
    ["submit"],
  ]);
  for (const screen of result.screens) console.log("›", screen);
  console.log("final states:", result.states.join("/"));
}
