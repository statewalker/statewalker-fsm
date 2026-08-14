import { buildStatechartCss } from "@statewalker/fsm-charts";

export function renderCss(rootSelector: string = ":root") {
  const css = buildStatechartCss({ prefix: rootSelector });
  const style = document.createElement("style");
  style.innerHTML = `
  ${css}
  ${rootSelector} {
    --transition-active-background-color: #eee;
    --transition-active-border-color: none;
    --transition-active-border-width: 0;
    --transition-active-line-color: blue;
    --transition-active-line-width: 1px;
    --transition-active-label-color: blue;
    --state-active-background-color: white;
    --state-active-border-color: blue;
    --state-active-border-width: 2px;
    --state-active-label-color: blue;
  }
  ${rootSelector} {
    --state-selected-border-width: 1px;
  }
  `;
  return style;
}
