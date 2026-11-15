import * as lodash from "lodash-es";
import {
  buildCharts,
  buildStatechartsPanel,
  type FsmStateConfig,
  getGraphParamsProvider,
  StateChartIndex,
  type StateGraphEdge,
} from "../../src/index.js";
import { describe, expect, it } from "../deps.js";

// statewalker-fsm#22: the pseudo-state keys are chosen once, when the chart is
// built, and travel with it; the index and the renderers read them from the chart.

const player: FsmStateConfig = {
  key: "Player",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "play", "Active"],
    ["*", "stop", "Idle"],
    ["Idle", "quit", ""],
  ],
  states: [
    {
      key: "Active",
      transitions: [
        ["", "*", "Playing"],
        ["Playing", "pause", "Paused"],
        ["Paused", "play", "Playing"],
        ["Paused", "eject", ""],
      ],
    },
  ],
};

function build(keys: { initialStateKey?: string; finalStateKey?: string } = {}) {
  let counter = 0;
  const newId = (prefix = "") => `${prefix}_${counter++}`;
  const statechart = buildCharts({
    lodash,
    config: player,
    newId,
    ...getGraphParamsProvider({
      stateFontSize: 12,
      stateTextPadding: 12,
      transitionsFontSize: 6,
      transitionsTextPadding: 6,
    }),
    ...keys,
  });
  return { statechart, newId };
}

const label = (e: StateGraphEdge) => `${e.from} -${e.event}-> ${e.to}`;

describe("pseudo-state keys travel with the built chart (#22)", () => {
  it("records the default keys on every chart level", () => {
    const { statechart } = build();
    expect(statechart.initialStateKey).toBe("<initial>");
    expect(statechart.finalStateKey).toBe("<final>");
    const active = statechart.children?.find((c) => c.key === "Active");
    expect(active?.initialStateKey).toBe("<initial>");
    expect(active?.finalStateKey).toBe("<final>");
  });

  it("records custom keys, and the index uses them without being told", () => {
    const { statechart } = build({ initialStateKey: "(start)", finalStateKey: "(end)" });
    expect(statechart.initialStateKey).toBe("(start)");
    expect(statechart.finalStateKey).toBe("(end)");

    const index = new StateChartIndex({ statechart });
    const keys = index.getStateNodes().map((n) => n.key);
    expect(keys).not.toContain("(start)");
    expect(keys).not.toContain("(end)");

    const [, idleId] = index.getStatesIds("Player", "Idle");
    const exit = index.findTransition(idleId, "quit", "");
    expect(exit && label(exit)).toBe("Idle -quit-> (end)");
  });

  it("renders custom pseudo-states as pseudo-states without passing the keys again", () => {
    const { statechart, newId } = build({ initialStateKey: "(start)", finalStateKey: "(end)" });
    const lines: string[] = [];
    buildStatechartsPanel({ statechart, newId, println: (s) => lines.push(s) });
    const html = lines.join("\n");
    expect(html).toContain("state__initial");
    expect(html).toContain("state__final");
    // Drawn as circles, not as labelled boxes.
    expect(html).not.toContain(">(start)<");
    expect(html).not.toContain(">(end)<");
  });
});

describe("StateChartIndex.getTransitionEdges: engine tuples to edges (#22)", () => {
  const { statechart } = build();
  const index = new StateChartIndex({ statechart });

  it("maps each [from, event, to] to the edge at the level where `from` is active", () => {
    const edges = index.getTransitionEdges(
      ["Player", "Active", "Playing"],
      [
        ["Playing", "pause", "Paused"],
        ["Active", "stop", "Idle"],
      ],
    );
    expect(edges.map(label).sort()).toEqual(["* -stop-> Idle", "Playing -pause-> Paused"]);
  });

  it("maps an exit transition (empty `to`) to the edge into the final pseudo-state", () => {
    const edges = index.getTransitionEdges(
      ["Player", "Active", "Paused"],
      [["Paused", "eject", ""]],
    );
    expect(edges.map(label)).toEqual(["Paused -eject-> <final>"]);
  });

  it("does not map a tuple whose source is not on the stack", () => {
    const edges = index.getTransitionEdges(
      ["Player", "Active", "Playing"],
      [["Paused", "play", "Playing"]],
    );
    expect(edges).toEqual([]);
  });

  it("returns no edges for a stack the chart does not contain", () => {
    expect(index.getTransitionEdges(["Player", "Nope"], [["Nope", "x", "Idle"]])).toEqual([]);
  });
});
