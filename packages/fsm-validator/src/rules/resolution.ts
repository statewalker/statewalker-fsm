import type { FsmStateConfig, FsmStateKey } from "../types.ts";

/**
 * State definition resolution.
 *
 * The engine resolves a transition's state key LEXICALLY, not locally.
 * `FsmProcess._newSubstate` starts at the state whose transition is being
 * followed and walks `state.parent` upward, taking the first
 * `descriptor.states[key]` it finds:
 *
 *     for (let state = parent; !descriptor && state; state = state.parent) {
 *       descriptor = state.descriptor?.states[toState];
 *     }
 *
 * So a state may be REFERENCED in a scope that does not DEFINE it — that is
 * the library's only mechanism for sharing a sub-machine between scopes.
 * Transition topology stays strictly local (a transition connects direct
 * sub-states of the state declaring it); only definition lookup is lexical.
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
  /** Keys of the ancestors, root first — the `path` a ValidationIssue carries. */
  path: string[];
  /** Ancestors nearest first, excluding `config` itself. */
  ancestors: FsmStateConfig[];
};

/**
 * The definition `key` resolves to from `config`: its own `states:` first,
 * then each ancestor's in turn. The nearest definition wins, exactly as with
 * lexically scoped variables. Returns undefined when nothing defines it.
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
  const walk = (
    config: FsmStateConfig,
    path: string[],
    ancestors: FsmStateConfig[],
  ) => {
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
 * Every scope that INSTANTIATES `definition` — one that names `key` in its own
 * transitions and whose lexical lookup lands on this definition rather than on
 * a nearer one that shadows it.
 */
export function referencingScopes(
  root: FsmStateConfig,
  key: FsmStateKey,
  definition: FsmStateConfig,
): Scope[] {
  return allScopes(root).filter(
    (scope) =>
      referencedKeys(scope.config).has(key) &&
      resolveDefinition(key, scope.config, scope.ancestors) === definition,
  );
}
