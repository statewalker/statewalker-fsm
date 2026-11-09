import { EVENT_EMPTY, STATE_FINAL, STATE_INITIAL } from "./fsm-state-config.ts";
import type { FsmStateDescriptor } from "./fsm-state-descriptor.ts";

// ---------------------------------------------------------------------------
// The traversal algorithm, shared by `FsmProcess` (async) and `FsmProcessSync`.
//
// Everything here is pure: given the current `(status, state, event)` it says
// which state to create next and what the status becomes afterwards. The two
// engines only differ in *how* they create states and run handlers (awaited or
// not), so keeping the decisions here guarantees both walk the tree identically.
// ---------------------------------------------------------------------------

// Status bitmask: where the process is in the enter/exit cycle of `dispatch`.
// Why a bitmask (rather than an enum): the loop tests *phases* with cheap bitwise
// masks — `status & STATUS_ENTER`, `status & this.mask` — and composite masks
// (ENTER / EXIT) are just OR-combinations of the primitive bits.
/** Not started / no current transition. */
export const STATUS_NONE = 0;
/** Entering: descended into a parent's first (initial) child. */
export const STATUS_FIRST = 1;
/** Entering: advanced to a resolved target (sibling) state. */
export const STATUS_NEXT = 2;
/** Rested on a leaf — dispatch returns control here (the default `mask`). */
export const STATUS_LEAF = 4;
/** Exiting: popped back up to the parent state. */
export const STATUS_LAST = 8;
/** Terminated: the machine has exited its root and cannot advance further. */
export const STATUS_FINISHED = 16;

/** Composite: any "entering" phase. */
export const STATUS_ENTER = STATUS_FIRST | STATUS_NEXT;
/** Composite: any "exiting" phase. */
export const STATUS_EXIT = STATUS_LEAF | STATUS_LAST;

/**
 * The minimal shape of a live state the traversal (and transition introspection)
 * needs. Both `FsmState` and `FsmStateSync` satisfy it.
 */
export interface FsmStateNode {
  key: string;
  parent?: FsmStateNode;
  descriptor?: FsmStateDescriptor;
}

/** What to create next: a state `key` under `parent`, compiled as `descriptor`. */
export type FsmStateTarget<S extends FsmStateNode> = {
  parent: S | undefined;
  key: string;
  descriptor: FsmStateDescriptor | undefined;
};

/**
 * Find the descriptor for a state named `key` entered under `parent`: the
 * nearest ancestor (starting at `parent`) that declares a child with that key.
 * Unknown keys resolve to `undefined` and behave as plain leaves.
 */
export function findStateDescriptor(
  parent: FsmStateNode | undefined,
  key: string,
): FsmStateDescriptor | undefined {
  for (let state = parent; state; state = state.parent) {
    const descriptor = state.descriptor?.states[key];
    if (descriptor) return descriptor;
  }
  return undefined;
}

/**
 * Resolve which child of `parent` follows `prevStateKey` on `event`, or
 * `undefined` when the transition leads to the final pseudo-state (or there is no
 * parent at all).
 */
export function resolveTargetStateKey(
  parent: FsmStateNode | undefined,
  prevStateKey: string | undefined,
  event: string | undefined,
): string | undefined {
  if (!parent) return undefined;
  const toState =
    parent.descriptor?.getTargetStateKey(prevStateKey || STATE_INITIAL, event || EVENT_EMPTY) ||
    STATE_FINAL;
  return toState || undefined;
}

/** Target for a state named `key` under `parent` (descriptor looked up in the ancestry). */
export function getSubstateTarget<S extends FsmStateNode>(
  parent: S | undefined,
  key: string,
): FsmStateTarget<S> {
  return { parent, key, descriptor: findStateDescriptor(parent, key) };
}

/**
 * First half of one traversal step: which state should be created next?
 *
 * - not started → the root;
 * - just entered a state → its initial child for `event`;
 * - exiting a state → its sibling resolved from `(state.key, event)`.
 *
 * Returns `undefined` when nothing is to be created (the step settles or pops).
 */
export function getNextStateTarget<S extends FsmStateNode>(
  status: number,
  state: S | undefined,
  event: string | undefined,
  rootKey: string,
  rootDescriptor: FsmStateDescriptor,
): FsmStateTarget<S> | undefined {
  if (status & STATUS_FINISHED) return undefined;
  if (status === STATUS_NONE) {
    return { parent: undefined, key: rootKey, descriptor: rootDescriptor };
  }
  const parent = (status & STATUS_ENTER ? state : state?.parent) as S | undefined;
  const prevKey = status & STATUS_ENTER ? STATE_INITIAL : state?.key;
  const key = resolveTargetStateKey(parent, prevKey, event);
  return key === undefined ? undefined : getSubstateTarget(parent, key);
}

/**
 * Second half of one traversal step: the `[state, status]` after it, given the
 * state created for {@link getNextStateTarget}'s target (or `undefined` if none).
 *
 * A created state becomes current with `STATUS_NEXT` (it replaced an exited
 * sibling) or `STATUS_FIRST` (it was descended into). Otherwise the walk either
 * settles on the current leaf (`STATUS_LEAF`) or pops to the parent
 * (`STATUS_LAST`), reaching `STATUS_FINISHED` once the root is exited.
 */
export function settleStep<S extends FsmStateNode>(
  status: number,
  state: S | undefined,
  nextState: S | undefined,
): [state: S | undefined, status: number] {
  if (nextState !== undefined) {
    return [nextState, status & STATUS_EXIT ? STATUS_NEXT : STATUS_FIRST];
  }
  if (status & STATUS_EXIT) {
    const parent = state?.parent as S | undefined;
    return [parent, parent ? STATUS_LAST : STATUS_FINISHED];
  }
  return [state, state ? STATUS_LEAF : STATUS_FINISHED];
}
