import type { FsmProcessDump } from "./fsm-process.ts";
import type { FsmStateDump } from "./fsm-state.ts";
import type { FsmStateConfig } from "./fsm-state-config.ts";
import type { FsmStateDescriptor } from "./fsm-state-descriptor.ts";
import {
  assertDumpRootKey,
  type FsmStateNode,
  getNextStateTarget,
  getSubstateTarget,
  STATUS_ENTER,
  STATUS_EXIT,
  STATUS_FINISHED,
  settleStep,
} from "./fsm-traversal.ts";

// ---------------------------------------------------------------------------
// The engine controller, shared by `FsmProcess` (async) and `FsmProcessSync`.
//
// `fsm-traversal.ts` holds the pure decisions (which state comes next). This
// module holds the hard part around them — the dispatch loop with its
// re-entrancy queue, the pending shutdown, unwinding, discarding a state
// created after a shutdown request, dump and restore — written ONCE, as
// generators. A generator never runs a handler itself: it yields a STEP, a
// thunk such as "run onExit of S" or "create state K under P", and the driver
// runs it and sends the result back. `runSync` runs each step directly;
// `runAsync` awaits it. The two engines are these two drivers over the same
// controller, so a shutdown, re-entrancy or restore fix lands in one place and
// the engines cannot drift apart.
// ---------------------------------------------------------------------------

/** Step kinds: run `type` handlers of `target` with `(target)` or with `args`; create a state. */
const OP_HANDLER = 0;
const OP_HANDLER_ARGS = 1;
const OP_CREATE = 2;
const OP_CALL = 3;
const NO_ARGS: unknown[] = [];

/**
 * One step of the controller: a handler run, a state creation or a call. Each
 * engine owns one record (`_step`) that its programs refill for every step they
 * yield, which keeps the sync hot path free of allocations. That is safe
 * because a driver runs a step as soon as it is yielded, and `run()` copies the
 * fields and clears the record before carrying the step out: a program a
 * handler starts meanwhile (a `dump`, a re-entrant `dispatch`) may refill it,
 * and nothing stays referenced once the step has run.
 */
export class FsmStep {
  op = OP_HANDLER;
  target?: FsmEngineState;
  type = "";
  args: unknown[] = NO_ARGS;
  engine?: FsmEngine<FsmEngineState>;
  parent?: FsmEngineState;
  key = "";
  descriptor?: FsmStateDescriptor;
  fn?: () => unknown;

  /** Run the `type` handlers of `target`, passing `target` itself. */
  handler(target: FsmEngineState | undefined, type: string): this {
    this.op = OP_HANDLER;
    this.target = target;
    this.type = type;
    return this;
  }

  /** Run the `type` handlers of `target` with `args`. */
  handlerWith(target: FsmEngineState, type: string, args: unknown[]): this {
    this.op = OP_HANDLER_ARGS;
    this.target = target;
    this.type = type;
    this.args = args;
    return this;
  }

  /** Create the state `key` under `parent` through the engine. */
  create<S extends FsmEngineState>(
    engine: FsmEngine<S>,
    parent: S | undefined,
    key: string,
    descriptor: FsmStateDescriptor | undefined,
  ): this {
    this.op = OP_CREATE;
    this.engine = engine as unknown as FsmEngine<FsmEngineState>;
    this.parent = parent;
    this.key = key;
    this.descriptor = descriptor;
    return this;
  }

  /** Call `fn` (any other awaitable step, such as a runner's `load`). */
  call(fn: () => unknown): this {
    this.op = OP_CALL;
    this.fn = fn;
    return this;
  }

  /**
   * Carry the step out; returns the handler run's, the creation's or the call's
   * result. The fields it reads are cleared first, so the record references
   * nothing once the step has run (and may be refilled while it runs).
   */
  run(): unknown {
    switch (this.op) {
      case OP_HANDLER: {
        const target = this.target;
        this.target = undefined;
        return target?._runHandler(this.type, target);
      }
      case OP_HANDLER_ARGS: {
        const target = this.target;
        const args = this.args;
        this.target = undefined;
        this.args = NO_ARGS;
        return target?._runHandler(this.type, ...args);
      }
      case OP_CALL: {
        const fn = this.fn;
        this.fn = undefined;
        return fn?.();
      }
      default: {
        const { engine, parent, descriptor } = this;
        this.engine = undefined;
        this.parent = undefined;
        this.descriptor = undefined;
        return engine?._newState(parent, this.key, descriptor);
      }
    }
  }
}

/** The controller's program: yields steps, receives their results, returns `R`. */
export type FsmSteps<R> = Generator<FsmStep, R, unknown>;

/** A live state as the controller sees it: a traversal node that runs handlers. */
export interface FsmEngineState extends FsmStateNode {
  parent?: FsmEngineState;
  handlers: Record<string, unknown[] | undefined>;
  _runHandler(type: string, ...args: unknown[]): unknown;
}

/**
 * The machine state the controller drives — the public fields of `FsmProcess`
 * and `FsmProcessSync`, plus the two flags of an in-progress shutdown and the
 * engine's own way of creating a state (with its `onStateCreate` handlers).
 */
export interface FsmEngine<S extends FsmEngineState> {
  state?: S;
  event?: string;
  nextEvents: string[];
  running: boolean;
  mask: number;
  status: number;
  config: FsmStateConfig;
  rootDescriptor: FsmStateDescriptor;
  eventFilter?: (event: string) => boolean;
  /** @internal A shutdown requested while busy; applied by the dispatch loop. */
  _pendingShutdown?: { event?: string };
  /** @internal `true` while the stack is being unwound. */
  _unwinding: boolean;
  /** Create a state and run the process's `onStateCreate` handlers. */
  _newState(
    parent: S | undefined,
    key: string,
    descriptor: FsmStateDescriptor | undefined,
  ): unknown;
  /** Called whenever the engine may have become idle. */
  _notifyIdle(): void;
  /** @internal The engine's one step record, refilled for every step (see `FsmStep`). */
  readonly _step: FsmStep;
  /**
   * @internal `true` for an engine that runs steps synchronously. Such an
   * engine skips a handler step with no handlers registered, which has no
   * observable effect there; an awaiting engine keeps every step, so its
   * timing (the microtasks between handlers) stays as it was.
   */
  readonly _sync: boolean;
}

/** Whether a `type` handler step on `state` must be yielded (see `_sync`). */
function hasStep<S extends FsmEngineState>(
  engine: FsmEngine<S>,
  state: FsmEngineState | undefined,
  type: string,
): boolean {
  return !engine._sync || !!state?.handlers[type]?.length;
}

/** Run the controller's steps synchronously; returns the program's result. */
export function runSync<R>(steps: FsmSteps<R>): R {
  let next = steps.next();
  while (!next.done) {
    let value: unknown;
    try {
      value = next.value.run();
    } catch (error) {
      next = steps.throw(error);
      continue;
    }
    next = steps.next(value);
  }
  return next.value;
}

/** Run the controller's steps, awaiting each; resolves to the program's result. */
export async function runAsync<R>(steps: FsmSteps<R>): Promise<R> {
  let next = steps.next();
  while (!next.done) {
    let value: unknown;
    try {
      value = await next.value.run();
    } catch (error) {
      next = steps.throw(error);
      continue;
    }
    next = steps.next(value);
  }
  return next.value;
}

/**
 * Force-exit the whole stack (root last), running each state's `onExit`.
 *
 * Requested while the machine is busy — from a handler, or while a dispatch or
 * another shutdown is in progress — it only records the request: the running
 * dispatch unwinds the stack as soon as the current handler returns, every
 * entered state is exited exactly once, and a state still being created is
 * discarded. A shutdown requested while one is unwinding is a no-op.
 */
export function* shutdownSteps<S extends FsmEngineState>(
  engine: FsmEngine<S>,
  event?: string,
): FsmSteps<void> {
  if (engine._unwinding) return;
  if (engine.running) {
    engine._pendingShutdown ??= { event };
    engine.nextEvents.length = 0;
    return;
  }
  yield* unwindSteps(engine, event);
  engine._notifyIdle();
}

/** Exit every state of the stack, innermost first, and finish the machine. */
export function* unwindSteps<S extends FsmEngineState>(
  engine: FsmEngine<S>,
  event?: string,
): FsmSteps<void> {
  const step = engine._step;
  engine._unwinding = true;
  try {
    engine.status = STATUS_FINISHED;
    engine.nextEvents.length = 0;
    while (engine.state) {
      const state = engine.state;
      engine.event = event;
      yield step.handler(state, "onExit");
      engine.state = state.parent as S | undefined;
    }
  } finally {
    engine._unwinding = false;
  }
}

/**
 * Feed an event and run the enter/exit cycle until the machine rests on a leaf
 * (`status & mask`) or finishes. A re-entrant call (from a handler) is queued
 * and applied in order once the current run settles; it returns `true` at once.
 * Events sent to a finished (or shutting down) machine are ignored. Returns
 * `false` once the machine has finished, `true` otherwise.
 */
export function* dispatchSteps<S extends FsmEngineState>(
  engine: FsmEngine<S>,
  event: string,
): FsmSteps<boolean> {
  if (engine.status & STATUS_FINISHED || engine._pendingShutdown) return false;
  // Queue the event. Re-entrant dispatches (from handlers running mid-settle)
  // append here and are drained in order — so no earlier event is overwritten.
  engine.nextEvents.push(event);
  if (engine.running) return true;
  engine.running = true;
  const step = engine._step;
  try {
    run: while (engine.nextEvents.length > 0 && !(engine.status & STATUS_FINISHED)) {
      const event = engine.nextEvents.shift() as string;
      if (engine.eventFilter && !engine.eventFilter(event)) continue;
      engine.event = event;
      while (true) {
        if (engine.status & STATUS_EXIT) {
          const exited = engine.state;
          if (hasStep(engine, exited, "onExit")) yield step.handler(exited, "onExit");
          if (engine._pendingShutdown) {
            // `exited` is done; unwind from its parent.
            engine.state = exited?.parent as S | undefined;
            break run;
          }
        }
        // One traversal step, inlined (see `updateSteps`): it runs per event on
        // the sync hot path, where a nested generator is measurable.
        if (engine.status & STATUS_FINISHED) break;
        const target = nextStateTarget(engine);
        const created = target
          ? ((yield step.create(engine, target.parent, target.key, target.descriptor)) as S)
          : undefined;
        if (!settleUpdate(engine, created)) break;
        if (engine._pendingShutdown) break run;
        if (engine.status & STATUS_ENTER) {
          if (hasStep(engine, engine.state, "onEnter")) {
            yield step.handler(engine.state, "onEnter");
          }
          if (engine._pendingShutdown) break run;
        }
        if (engine.status & engine.mask) break;
      }
    }
  } finally {
    engine.running = false;
    // Applied even if something escaped the loop (e.g. a throwing error sink),
    // so a requested shutdown is never left stuck and idle waiters are released.
    try {
      // Handlers may have requested a shutdown during the loop (TS cannot see that).
      const pending = engine._pendingShutdown as { event?: string } | undefined;
      if (pending) {
        engine._pendingShutdown = undefined;
        yield* unwindSteps(engine, pending.event);
      }
    } finally {
      if (engine.status & STATUS_FINISHED) engine.nextEvents.length = 0;
      engine._notifyIdle();
    }
  }
  return !(engine.status & STATUS_FINISHED);
}

/**
 * One step of the traversal (see `fsm-traversal.ts`): create the next state,
 * if any, and update `state` / `status`. Returns `false` when finished.
 */
export function* updateSteps<S extends FsmEngineState>(engine: FsmEngine<S>): FsmSteps<boolean> {
  if (engine.status & STATUS_FINISHED) return false;
  const target = nextStateTarget(engine);
  const created = target
    ? ((yield engine._step.create(engine, target.parent, target.key, target.descriptor)) as S)
    : undefined;
  return settleUpdate(engine, created);
}

/** First half of a traversal step: the state to create next, if any. */
function nextStateTarget<S extends FsmEngineState>(engine: FsmEngine<S>) {
  return getNextStateTarget(
    engine.status,
    engine.state,
    engine.event,
    engine.config.key,
    engine.rootDescriptor,
  );
}

/**
 * Second half of a traversal step, once `created` (the next state, or
 * `undefined`) exists. Returns `false` when finished.
 */
function settleUpdate<S extends FsmEngineState>(
  engine: FsmEngine<S>,
  created: S | undefined,
): boolean {
  if (engine._pendingShutdown) {
    // A shutdown was requested while the state was being created: drop it. If
    // the current state has just exited, the unwinding starts from its parent.
    if (engine.status & STATUS_EXIT) engine.state = engine.state?.parent as S | undefined;
    return true;
  }
  [engine.state, engine.status] = settleStep(engine.status, engine.state, created);
  return !(engine.status & STATUS_FINISHED);
}

/** Snapshot the machine: `{ status, event, stack }` (stack root→leaf). */
export function* dumpSteps<S extends FsmEngineState>(
  engine: FsmEngine<S>,
  args: unknown[],
): FsmSteps<FsmProcessDump> {
  const states: S[] = [];
  for (let state = engine.state; state; state = state.parent as S | undefined) {
    states.unshift(state);
  }
  const step = engine._step;
  const stack: FsmStateDump[] = [];
  for (const state of states) {
    const stateDump: FsmStateDump = { key: state.key, data: {} };
    yield step.handlerWith(state, "dump", [state, stateDump.data, ...args]);
    stack.push(stateDump);
  }
  return { status: engine.status, event: engine.event, stack };
}

/**
 * Rebuild the machine from a dump (from either engine): recreate each state
 * (firing `onStateCreate`) and replay its `restore` hooks. The current stack is
 * replaced as-is — its `onExit` handlers do not run.
 */
export function* restoreSteps<S extends FsmEngineState>(
  engine: FsmEngine<S>,
  owner: string,
  dump: FsmProcessDump,
  args: unknown[],
): FsmSteps<void> {
  if (engine.running || engine._unwinding) {
    throw new Error(`${owner}.restore() called while a dispatch or shutdown is running`);
  }
  assertDumpRootKey(owner, dump, engine.config.key);
  engine._pendingShutdown = undefined;
  engine.status = dump.status || 0;
  engine.event = dump.event;
  engine.nextEvents.length = 0;
  engine.state = undefined;
  const step = engine._step;
  for (const stateDump of dump.stack) {
    const target = engine.state
      ? getSubstateTarget(engine.state, stateDump.key)
      : { parent: undefined, key: stateDump.key, descriptor: engine.rootDescriptor };
    const state = (yield step.create(engine, target.parent, target.key, target.descriptor)) as S;
    engine.state = state;
    yield step.handlerWith(state, "restore", [state, stateDump.data, ...args]);
  }
}
