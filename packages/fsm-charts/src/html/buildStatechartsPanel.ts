import type { StateChart } from "../types/StateChart.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { buildStatechartSvg } from "./buildStatechartSvg.js";

export function buildStatechartsPanel({
  statechart,
  newId,
  println,
  initialStateKey,
  finalStateKey,
}: {
  statechart: StateChart;
  newId: (prefix: string) => string;
  println: (str: string) => void;
  /** @deprecated The key recorded on the chart when it was built is used. */
  initialStateKey?: string;
  /** @deprecated The key recorded on the chart when it was built is used. */
  finalStateKey?: string;
}): void {
  render(statechart, println);

  function render(statechart: StateChart, println: (str: string) => void) {
    println(`  <details class="state-details" data-state-id="${escapeHtml(statechart.id)}">`);
    println(
      `    <summary class="state-details__label">${escapeHtml(statechart.text ?? statechart.state)}</summary>`,
    );
    println(`    <div class="state-details__content">`);
    const printChildren = (str: string) => println(`    ${str}`);
    if (statechart.nodes.length) {
      println(`      <div class="state-details__chart">`);
      buildStatechartSvg({
        graph: statechart,
        newId,
        println: printChildren,
        initialStateKey,
        finalStateKey,
      });
      println(`    </div>`);
    }
    println(`    <div class="state-details__description">`);
    println(`    </div>`);
    for (const child of statechart.children || []) {
      render(child, printChildren);
    }
    println(`    </div>`);
    println(`  </details>`);
  }
}
