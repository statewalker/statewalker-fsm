import type { GraphParamsProvider } from "../types/GraphParamsProvider.js";
import type { Padding } from "../types/Padding.js";
import { getPadding } from "../utils/getPadding.js";
import { getLabelDimensions } from "./getLabelDimensions.js";

/**
 * Provides default functions measuring dimensions for state nodes and transition edges in the graph.
 * @param fontSize - The font size for the state and transition labels.
 * @param stateFontSize - The font size for the state labels.
 * @param stateTextPadding - The padding around the state labels.
 * @param transitionsFontSize - The font size for the transition labels.
 * @param transitionsTextPadding - The padding around the transition labels.
 */
export function getGraphParamsProvider({
  fontSize = 14,
  stateFontSize = fontSize,
  stateTextPadding = 0,
  transitionsFontSize = fontSize,
  transitionsTextPadding = 0,
  getStateLabel = (state: string) => state,
  getTransitionLabel = (_fromState: string, event: string, _toState: string) =>
    event,
}: {
  fontSize?: number;
  stateFontSize?: number;
  stateTextPadding?: Padding;
  transitionsFontSize?: number;
  transitionsTextPadding?: Padding;
  getStateLabel?: (state: string) => string;
  getTransitionLabel?: (
    fromState: string,
    event: string,
    toState: string,
  ) => string;
} = {}): GraphParamsProvider {
  return {
    getStateParams: (stateKey: string, state: string = stateKey) => {
      const padding = getPadding(stateTextPadding);
      const fontSize = stateFontSize;
      const stateLabel = getStateLabel(state);
      return {
        ...getLabelDimensions(stateLabel, {
          padding,
          fontSize,
        }),
        state,
        text: stateLabel,
        key: stateKey,
        padding,
        fontSize,
      };
    },
    getTransitionParams: (
      fromStateKey: string,
      event: string,
      toStateKey: string,
    ) => {
      const padding = getPadding(transitionsTextPadding);
      const fontSize = transitionsFontSize;
      const eventLabel = getTransitionLabel(fromStateKey, event, toStateKey);
      return {
        ...getLabelDimensions(eventLabel, {
          padding,
          fontSize,
        }),
        from: fromStateKey,
        event,
        to: toStateKey,
        text: eventLabel,
        padding,
        fontSize,
      };
    },
  };
}
