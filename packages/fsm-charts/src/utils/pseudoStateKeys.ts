/**
 * The default keys of the pseudo-state nodes drawn for `""` in a transition:
 * the initial node (an empty source) and the final node (an empty target).
 *
 * They are chosen once, when `buildFlatCharts` / `buildCharts` lay a chart
 * out, and recorded on the chart (`initialStateKey`, `finalStateKey`); the
 * index and the renderers read them from there. These defaults live only
 * here.
 */
export const DEFAULT_INITIAL_STATE_KEY = "<initial>";
export const DEFAULT_FINAL_STATE_KEY = "<final>";

/** The pseudo-state keys of a built chart, with an optional explicit override. */
export function getPseudoStateKeys(
  chart: { initialStateKey?: string; finalStateKey?: string } | undefined,
  override: { initialStateKey?: string; finalStateKey?: string } = {},
): { initialStateKey: string; finalStateKey: string } {
  return {
    initialStateKey:
      override.initialStateKey ?? chart?.initialStateKey ?? DEFAULT_INITIAL_STATE_KEY,
    finalStateKey: override.finalStateKey ?? chart?.finalStateKey ?? DEFAULT_FINAL_STATE_KEY,
  };
}
