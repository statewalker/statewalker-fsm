import { serializeCss } from "../utils/serializeCss.js";
import {
  activeStatesStyle,
  activeTransitionsStyle,
  buildStatechartStyles,
  buildStatechartStylesWithModifier,
  buildStateDetailsStyle,
  buildStateDetailsStyleWithModifier,
  selectedStatesStyle,
  selectedTransitionsStyle,
} from "./buildStatechartStyles.js";

export function buildStatechartCss({ prefix = "" } = {}): string {
  const root = prefix || ":root";
  return [
    buildStatechartStyles({ root }),
    buildStatechartStylesWithModifier({
      root,
      modifier: "selected",
      states: selectedStatesStyle,
      transitions: selectedTransitionsStyle,
    }),
    buildStatechartStylesWithModifier({
      root,
      modifier: "active",
      states: activeStatesStyle,
      transitions: activeTransitionsStyle,
    }),
    buildStateDetailsStyle({ root }),
    buildStateDetailsStyleWithModifier({
      root,
      modifier: "selected",
      states: selectedStatesStyle,
    }),
    buildStateDetailsStyleWithModifier({
      root,
      modifier: "active",
      states: activeStatesStyle,
    }),
  ]
    .map(serializeCss)
    .join("\n");
}
