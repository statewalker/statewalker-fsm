import type { FsmAnyProcess } from "@statewalker/fsm";
import { _addStateRenderer } from "./_addStateRenderer.js";

/**
 * A `<div>` showing `renderer(stack)` for the current state of `process` (either
 * engine), replaced on every transition. When `invalidation` resolves, the element
 * stops following the process.
 */
export function renderStateDescription({
  process,
  renderer,
  invalidation,
}: {
  process: FsmAnyProcess;
  renderer: (statesStack: string[]) => undefined | Node;
  invalidation?: Promise<void>;
}) {
  const div = document.createElement("div");
  const dispose = _addStateRenderer(process, (stack) => {
    const view = renderer(stack);
    if (!view) return;
    // A DocumentFragment is emptied by append (its children move into `div`), so
    // `view.parentElement` is always null — the old cleanup was a no-op and
    // descriptions accumulated. Snapshot the appended nodes and remove THOSE.
    const nodes = view instanceof DocumentFragment ? [...view.childNodes] : [view];
    div.append(...nodes);
    return () => {
      for (const node of nodes) node.parentNode?.removeChild(node);
    };
  });
  invalidation?.then(() => dispose());
  return div;
}
