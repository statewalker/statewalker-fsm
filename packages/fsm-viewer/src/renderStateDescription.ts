import type { FsmProcess } from "@statewalker/fsm";
import { _addStateRenderer } from "./_addStateRenderer.js";

export function renderStateDescription({
  process,
  renderer,
}: {
  process: FsmProcess;
  renderer: (statesStack: string[]) => undefined | Node;
}) {
  const div = document.createElement("div");
  _addStateRenderer(process, (stack) => {
    const view = renderer(stack);
    if (!view) return;
    // A DocumentFragment is emptied by append (its children move into `div`), so
    // `view.parentElement` is always null — the old cleanup was a no-op and
    // descriptions accumulated. Snapshot the appended nodes and remove THOSE.
    const nodes =
      view instanceof DocumentFragment ? [...view.childNodes] : [view];
    div.append(...nodes);
    return () => {
      for (const node of nodes) node.parentNode?.removeChild(node);
    };
  });
  return div;
}
