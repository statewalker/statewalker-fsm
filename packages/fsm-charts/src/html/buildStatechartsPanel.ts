import type { StateChart } from "../types/StateChart.js";
import { buildStatechartSvg } from "./buildStatechartSvg.js";

export function buildStatechartsPanel({
  statechart,
  newId,
  println,
  initialStateKey = "<initial>",
  finalStateKey = "<final>",
}: {
  statechart: StateChart;
  newId: (prefix: string) => string;
  println: (str: string) => void;
  initialStateKey?: string;
  finalStateKey?: string;
}): void {
  render(statechart, println);

  function render(statechart: StateChart, println: (str: string) => void) {
    println(
      `  <details class="state-details" data-state-id="${statechart.id}">`,
    );
    println(
      `    <summary class="state-details__label">${statechart.text ?? statechart.state}</summary>`,
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
