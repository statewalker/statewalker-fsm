import type { FsmStateConfig, FsmStateKey } from "../types.ts";

/**
 * State definition resolution.
 *
 * The engine resolves a transition's state key DYNAMICALLY, through the live
 * parent chain. `findStateDescriptor` (in `@statewalker/fsm`'s traversal,
 * shared by `FsmProcess` and `FsmProcessSync`) starts at the running state
 * whose transition is being followed and walks `state.parent` upward, taking
 * the first `descriptor.states[key]` it finds:
 *
 *     for (let state = parent; state; state = state.parent) {
 *       const descriptor = state.descriptor?.states[key];
 *       if (descriptor) return descriptor;
 *     }
 *
 * So a state may be REFERENCED in a scope that does not DEFINE it — that is
 * the library's only mechanism for sharing a sub-machine between scopes. And
 * because the chain is the RUNNING one, a definition shared from an ancestor
 * and entered inside scope A resolves its own keys through A and A's running
 * ancestors, not through the scope that holds the definition. The same
 * definition can therefore resolve a key differently in each place it is
 * entered. This is the contract (statewalker-fsm#25): the validator follows
 * it by enumerating every INSTANTIATION — every place the runtime can enter a
 * definition, with the running ancestor chain it gets there.
 *
 * Transition topology stays strictly local (a transition connects direct
 * sub-states of the state declaring it); only definition lookup walks up.
 *
 * When nothing on the chain defines the key the engine does not complain: it
 * creates an empty state with no descriptor and carries on, which presents as
 * a machine that silently stalls. Catching that is the validator's job.
 */

/** `""` (initial/exit) and `"*"` (wildcard) name no state definition. */
export function isPseudoKey(key: string): boolean {
  return key === "" || key === "*";
}

/** A state in the tree, with the ancestor chain that resolution walks. */
export type Scope = {
  config: FsmStateConfig;
  /** Keys of the ancestors, root first — the `path` a RuleContext carries. */
  path: string[];
  /** Ancestors nearest first, excluding `config` itself. */
  ancestors: FsmStateConfig[];
};

/**
 * The definition `key` resolves to from `config`: its own `states:` first,
 * then each ancestor's in turn. The nearest definition wins. Pass the LIVE
 * chain of an instantiation (see {@link instancesByDefinition}) to get what
 * the runtime enters there. Returns undefined when nothing defines it.
 */
export function resolveDefinition(
  key: FsmStateKey,
  config: FsmStateConfig,
  ancestors: FsmStateConfig[],
): FsmStateConfig | undefined {
  for (const scope of [config, ...ancestors]) {
    const found = scope.states?.find((s) => s.key === key);
    if (found) return found;
  }
  return undefined;
}

/** Every state in the tree, each with its ancestor chain. */
export function allScopes(root: FsmStateConfig): Scope[] {
  const out: Scope[] = [];
  const walk = (config: FsmStateConfig, path: string[], ancestors: FsmStateConfig[]) => {
    out.push({ config, path, ancestors });
    for (const child of config.states ?? []) {
      walk(child, [...path, config.key], [config, ...ancestors]);
    }
  };
  walk(root, [], []);
  return out;
}

/** The distinct state keys a scope's own transitions name, pseudo-keys aside. */
export function referencedKeys(config: FsmStateConfig): Set<FsmStateKey> {
  const keys = new Set<FsmStateKey>();
  for (const t of config.transitions ?? []) {
    if (!Array.isArray(t) || t.length !== 3) continue;
    const [from, , to] = t;
    if (!isPseudoKey(from)) keys.add(from);
    if (!isPseudoKey(to)) keys.add(to);
  }
  return keys;
}

/**
 * One place the runtime enters a definition: the definition, and the running
 * ancestors it has there. Unlike a {@link Scope}, `ancestors` is the LIVE
 * chain — the scopes that entered it — which differs from the config tree
 * whenever a shared definition is entered.
 */
export type Instance = Scope;

/**
 * Upper bound on the instances enumerated for one configuration. Sharing can
 * make the number of instantiation paths grow exponentially with depth; real
 * machines stay far below this, and past it the remaining paths are not
 * explored (the rules then see fewer instantiations, never wrong ones).
 */
const MAX_INSTANCES = 10_000;

const instanceCache = new WeakMap<FsmStateConfig, Map<FsmStateConfig, Instance[]>>();

/**
 * Every instantiation of every definition reachable from `root`, keyed by
 * definition. Starting at the root, each instance's transitions name keys;
 * each key resolves through the instance's live chain (its own `states:`,
 * then each running ancestor's) to the definition the runtime enters there,
 * which becomes an instance with this one prepended to its chain.
 *
 * A definition already on its own live chain is recorded but not expanded
 * again: below it the same lookups repeat, so expanding it adds nothing and
 * would not terminate.
 */
export function instancesByDefinition(root: FsmStateConfig): Map<FsmStateConfig, Instance[]> {
  const cached = instanceCache.get(root);
  if (cached) return cached;
  const out = new Map<FsmStateConfig, Instance[]>();
  let count = 0;
  const visit = (instance: Instance) => {
    if (count >= MAX_INSTANCES) return;
    count++;
    const list = out.get(instance.config);
    if (list) list.push(instance);
    else out.set(instance.config, [instance]);
    if (instance.ancestors.includes(instance.config)) return;
    const path = [...instance.path, instance.config.key];
    const ancestors = [instance.config, ...instance.ancestors];
    for (const key of referencedKeys(instance.config)) {
      const definition = resolveDefinition(key, instance.config, instance.ancestors);
      if (definition) visit({ config: definition, path, ancestors });
    }
  };
  visit({ config: root, path: [], ancestors: [] });
  instanceCache.set(root, out);
  return out;
}

/** The places the runtime enters `config`; empty when it is never entered. */
export function instancesOf(root: FsmStateConfig, config: FsmStateConfig): Instance[] {
  return instancesByDefinition(root).get(config) ?? [];
}

/**
 * The live chains a rule must check `config`'s own transitions against: one
 * per instantiation. A definition the runtime never enters (S4 reports it)
 * is checked against its place in the config tree, as if its parent entered
 * it, so its own mistakes are still reported.
 */
export function resolutionContexts(ctx: {
  config: FsmStateConfig;
  path: string[];
  ancestors: FsmStateConfig[];
  root: FsmStateConfig;
}): Instance[] {
  const instances = instancesOf(ctx.root, ctx.config);
  if (instances.length > 0) return instances;
  return [{ config: ctx.config, path: ctx.path, ancestors: ctx.ancestors }];
}

/**
 * Every scope that ENTERS `definition` at runtime: the live parent of each of
 * its instances, once per scope config (the rules that use this look only at
 * the entering scope's own transitions), with the live path of the first
 * place it does so. For an ordinary state that is its parent; for a shared
 * one, every caller whose lookup resolves to this definition rather than to a
 * nearer one that shadows it.
 */
export function referencingScopes(root: FsmStateConfig, definition: FsmStateConfig): Scope[] {
  const out: Scope[] = [];
  for (const instance of instancesOf(root, definition)) {
    const [parent, ...ancestors] = instance.ancestors;
    if (!parent || out.some((s) => s.config === parent)) continue;
    out.push({ config: parent, path: instance.path.slice(0, -1), ancestors });
  }
  return out;
}

/**
 * Whether `scope` has a transition taking `event` out of its sub-state `key`
 * (wildcards included). An unhandled event makes `scope` itself exit.
 */
export function handlesEvent(scope: FsmStateConfig, key: FsmStateKey, event: string): boolean {
  return (scope.transitions ?? []).some(
    ([from, evt]) => (from === key || from === "*") && (evt === event || evt === "*"),
  );
}
