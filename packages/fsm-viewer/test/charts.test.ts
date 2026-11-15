// @vitest-environment jsdom
import { FsmProcessSync, type FsmStateConfig, getStateTransitions } from "@statewalker/fsm";
import type { StateGraphEdge } from "@statewalker/fsm-charts";
import * as lodash from "lodash-es";
import { afterEach, vi } from "vitest";
import { newProcessCharts } from "../src/newProcessCharts.js";
import { prepareStateDescriptions } from "../src/prepareStateDescriptions.js";
import { renderStateCharts } from "../src/renderStateCharts.js";
import { describe, expect, it } from "./deps.js";

// A media player: the wildcard-source rule `["*", "stop", "Idle"]` applies in any
// state of Player, so it is enabled while in Player > Active > Playing.
const player: FsmStateConfig = {
  key: "Player",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "play", "Active"],
    ["*", "stop", "Idle"],
  ],
  states: [
    {
      key: "Active",
      transitions: [
        ["", "*", "Playing"],
        ["Playing", "pause", "Paused"],
        ["Paused", "play", "Playing"],
        ["Paused", "pause", "Playing"],
      ],
    },
  ],
};

const label = (e: StateGraphEdge) => `${e.from} -${e.event}-> ${e.to}`;

function transitionElements(element: HTMLElement) {
  return [...element.querySelectorAll("g[data-transition-id]")] as SVGGElement[];
}

function click(elm: Element) {
  elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

// The chart's edges by id, collected by clicking every transition element once.
// Call it while clicks cannot dispatch (no chart-level process, or one not started).
function collectEdges(element: HTMLElement, clicked: StateGraphEdge[]) {
  const edges: Record<string, StateGraphEdge> = {};
  for (const elm of transitionElements(element)) {
    clicked.length = 0;
    click(elm);
    const edge = clicked[0];
    if (edge) edges[edge.id] = edge;
  }
  clicked.length = 0;
  return edges;
}

function findEdgeElement(
  element: HTMLElement,
  edges: Record<string, StateGraphEdge>,
  text: string,
): Element {
  const edge = Object.values(edges).find((e) => label(e) === text);
  if (!edge) throw new Error(`No edge ${text}`);
  const elm = element.querySelector(`g[data-transition-id="${edge.id}"]`);
  if (!elm) throw new Error(`No element for ${text}`);
  return elm;
}

function activeEdges(element: HTMLElement, edges: Record<string, StateGraphEdge>) {
  const ids = new Set(
    [...element.querySelectorAll("[data-transition-id].transition--active")].map((elm) =>
      elm.getAttribute("data-transition-id"),
    ),
  );
  return Object.values(edges)
    .filter((e) => ids.has(e.id))
    .map(label)
    .sort();
}

function stackOf(process: FsmProcessSync): string[] {
  const stack: string[] = [];
  for (let s = process.state; s; s = s.parent) stack.unshift(s.key);
  return stack;
}

describe("newProcessCharts: highlighted transitions follow the engine (#32)", () => {
  function setup() {
    const clicked: StateGraphEdge[] = [];
    const chart = newProcessCharts({
      config: player,
      lodash,
      onEventClick: (edge) => clicked.push(edge),
    });
    const edges = collectEdges(chart, clicked);
    return { chart, edges };
  }

  it("highlights wildcard-source transitions of the active stack", () => {
    const { chart, edges } = setup();
    chart.selectState(["Player", "Active", "Playing"]);
    expect(activeEdges(chart, edges)).toEqual(["* -stop-> Idle", "Playing -pause-> Paused"]);
  });

  it("highlights exactly the engine's enabled transitions in every state", () => {
    const { chart, edges } = setup();
    const process = new FsmProcessSync(player);
    for (const event of ["", "play", "pause", "pause", "stop"]) {
      process.dispatch(event);
      chart.selectState(stackOf(process));
      const active = activeEdges(chart, edges);
      // One highlighted edge per transition the engine reports, never more.
      expect(active.length).toBe(getStateTransitions(process.state).length);
      for (const [from, ev, to] of getStateTransitions(process.state)) {
        expect(active.some((a) => a === `${from} -${ev}-> ${to}` || a === `* -${ev}-> ${to}`)).toBe(
          true,
        );
      }
    }
  });

  it("does not highlight a same-event edge leaving another state", () => {
    const { chart, edges } = setup();
    chart.selectState(["Player", "Active", "Playing"]);
    expect(activeEdges(chart, edges)).not.toContain("Paused -pause-> Playing");
  });
});

describe("renderStateCharts: clicking an edge (#33)", () => {
  function setup(config: FsmStateConfig) {
    const process = new FsmProcessSync(config);
    const clicked: StateGraphEdge[] = [];
    const chart = renderStateCharts({
      process,
      lodash,
      onEventClick: (edge) => clicked.push(edge),
    });
    // Not started yet: no transition is enabled, so these clicks dispatch nothing.
    const edges = collectEdges(chart, clicked);
    process.dispatch("");
    return { process, chart, edges };
  }

  it("ignores an edge that does not leave the current state", () => {
    const { process, chart, edges } = setup({
      key: "App",
      transitions: [
        ["", "*", "A"],
        ["A", "go", "X"],
        ["A", "next", "B"],
        ["B", "go", "C"],
      ],
    });
    expect(stackOf(process)).toEqual(["App", "A"]);
    click(findEdgeElement(chart, edges, "B -go-> C"));
    expect(stackOf(process)).toEqual(["App", "A"]);
    click(findEdgeElement(chart, edges, "A -go-> X"));
    expect(stackOf(process)).toEqual(["App", "X"]);
  });

  it("ignores the initial edge even when a wildcard-event rule exists", () => {
    const { process, chart, edges } = setup({
      key: "App",
      transitions: [
        ["", "*", "A"],
        ["A", "*", "B"],
      ],
    });
    expect(stackOf(process)).toEqual(["App", "A"]);
    click(findEdgeElement(chart, edges, "<initial> -*-> A"));
    expect(stackOf(process)).toEqual(["App", "A"]);
  });

  it("dispatches a wildcard-source edge enabled in the current state", () => {
    const { process, chart, edges } = setup(player);
    process.dispatch("play");
    expect(stackOf(process)).toEqual(["Player", "Active", "Playing"]);
    expect(activeEdges(chart, edges)).toContain("* -stop-> Idle");
    click(findEdgeElement(chart, edges, "* -stop-> Idle"));
    expect(stackOf(process)).toEqual(["Player", "Idle"]);
  });
});

describe("renderer option takes key stacks (#39)", () => {
  afterEach(() => {
    delete (HTMLElement.prototype as { innerText?: string }).innerText;
  });

  it("accepts the renderer returned by prepareStateDescriptions, once per state", () => {
    // jsdom does not implement innerText, which prepareStateDescriptions reads.
    Object.defineProperty(HTMLElement.prototype, "innerText", {
      configurable: true,
      get(this: HTMLElement) {
        return this.textContent ?? "";
      },
    });
    const docs = document.createElement("section");
    docs.innerHTML = [
      "<h2>[Player] Media player</h2>",
      "<h3>[Idle] Waiting</h3><p>Nothing plays.</p>",
      "<h3>[Active] Busy</h3><p>Playing or paused.</p>",
    ].join("");
    const describeState = prepareStateDescriptions({ element: docs, rootStateKey: "Player" });
    const calls: string[] = [];
    const renderer = (stack: string[]) => {
      calls.push(stack.join(">"));
      return describeState(stack);
    };
    const chart = newProcessCharts({ config: player, lodash, renderer });
    const text = [...chart.querySelectorAll(".state-details__description")].map(
      (elm) => elm.textContent,
    );
    // Panels exist for the composite states: Player and Active.
    expect(text).toEqual(["Media player", "BusyPlaying or paused."]);
    expect(calls.length).toBe(new Set(calls).size);
    expect(calls).toContain("Player>Active");
    expect(calls).toContain("Player>Active>Playing");
  });
});

describe("disposal (#42)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function trackListeners() {
    const added = new Set<EventListenerOrEventListenerObject>();
    const add = vi.spyOn(Element.prototype, "addEventListener");
    const remove = vi.spyOn(Element.prototype, "removeEventListener");
    return {
      added,
      removed: () => remove.mock.calls.map(([, fn]) => fn),
      record: () => {
        for (const [, fn] of add.mock.calls) if (fn) added.add(fn);
      },
    };
  }

  it("dispose() removes the DOM listeners and the process subscription", () => {
    const listeners = trackListeners();
    const process = new FsmProcessSync(player);
    const onStateClick = vi.fn();
    const onEventClick = vi.fn();
    const chart = renderStateCharts({ process, lodash, onStateClick, onEventClick });
    listeners.record();
    expect(listeners.added.size).toBeGreaterThan(0);
    process.dispatch("");
    expect(chart.querySelectorAll(".state--active").length).toBeGreaterThan(0);

    chart.dispose();
    const removed = new Set(listeners.removed());
    for (const fn of listeners.added) expect(removed.has(fn)).toBe(true);

    process.dispatch("play");
    expect(chart.querySelectorAll(".state--active, .transition--active").length).toBe(0);
    for (const elm of chart.querySelectorAll("[data-state-id], [data-transition-id]")) click(elm);
    expect(onStateClick).not.toHaveBeenCalled();
    expect(onEventClick).not.toHaveBeenCalled();
    expect(stackOf(process)).toEqual(["Player", "Active", "Playing"]);
  });

  it("invalidation disposes the chart", async () => {
    const listeners = trackListeners();
    let invalidate = () => {};
    const invalidation = new Promise<void>((resolve) => {
      invalidate = resolve;
    });
    const chart = newProcessCharts({ config: player, lodash, invalidation });
    listeners.record();
    invalidate();
    await invalidation;
    const removed = new Set(listeners.removed());
    for (const fn of listeners.added) expect(removed.has(fn)).toBe(true);
    expect(typeof chart.dispose).toBe("function");
  });
});
