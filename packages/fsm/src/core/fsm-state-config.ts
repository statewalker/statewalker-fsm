// Sentinel keys used inside `FsmStateConfig.transitions` tuples. The raw `""` and
// `"*"` literals are ambiguous at the call site — `["", "start", "Active"]` does not
// visibly say "from the *initial* state" — so these named constants document intent
// while keeping the runtime value (a shared empty string / asterisk) identical, which
// keeps configs plain-serializable.

/** Wildcard `from`-state: a transition that applies in *any* state. */
export const STATE_ANY = "*";
/** Empty `from`-state: the *initial* pseudo-state a parent enters into. */
export const STATE_INITIAL = "";
/** Empty `to`-state: the *final* pseudo-state; entering it exits the parent. */
export const STATE_FINAL = "";
/** Wildcard `event`: a transition triggered by *any* event. */
export const EVENT_ANY = "*";
/** Empty event: the eventless/automatic transition (fires with no named event). */
export const EVENT_EMPTY = "";

export type FsmStateKey = string;
export type FsmEventKey = string;

/**
 * Declarative definition of a (possibly nested) state machine.
 *
 * One plain-object shape describes an entire HFSM, so machines stay serializable,
 * diffable, and inspectable by tooling — the config is data, not code. A config has:
 * - `key` — the state's name (unique among its siblings);
 * - `transitions` — `[from, event, to]` tuples, where `from`/`to` name sibling
 *   states, `""` is the initial (`from`) or final (`to`) pseudo-state, and `"*"` is a
 *   wildcard (see the constants above);
 * - `states` — nested child configs; entering this state descends into its initial
 *   child. The index signature lets consumers attach arbitrary metadata.
 *
 * Pass a config to `new FsmProcess(config)` or `startProcess(ctx, config, …)`; it is
 * compiled once into an `FsmStateDescriptor` for fast lookup at runtime.
 */
export type FsmStateConfig = {
  key: FsmStateKey;
  transitions?: [from: FsmStateKey, event: FsmEventKey, to: FsmStateKey][];
  states?: FsmStateConfig[];
} & Record<string, unknown>;
