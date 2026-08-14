import {
  FsmProcess,
  type FsmStateConfig,
  setProcessPrinter,
} from "@statewalker/fsm";
import { prepareStateDescriptions, renderStateCharts } from "../index.js";

export * from "@statewalker/fsm";

import * as _ from "lodash-es";

export function renderProcess(
  processConfig: FsmStateConfig,
  {
    element,
    invalidation,
    direction = "lr",
  }: {
    element?: HTMLElement;
    invalidation?: Promise<void>;
    direction?: "lr" | "rl" | "tb" | "bt";
  } = {},
) {
  const renderer: (stateStack: string[]) => undefined | Node = element
    ? prepareStateDescriptions({
        element,
        rootStateKey: processConfig.key,
      })
    : () => undefined;

  const process = new FsmProcess(processConfig);
  setProcessPrinter(process, {
    print: console.warn,
    prefix: `[${processConfig.key}:${Date.now()}]`,
  });
  // const description = renderStateDescription({ process, renderer });
  const charts = renderStateCharts({
    process,
    renderer: (nodesStack) => {
      const statesStack = nodesStack.map((node) => node.key);
      return renderer(statesStack);
    },
    direction,
    lodash: _,
    invalidation,
  });
  invalidation?.then(async () => {
    await process.shutdown("exit");
    // description.remove();
    charts.remove();
  });
  return {
    // description,
    charts,
    process,
  };
}
