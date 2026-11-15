import type { StateChart, StateGraphEdge, StateGraphNode } from "../types/index.js";
import { getPseudoStateKeys } from "../utils/pseudoStateKeys.js";

/** An engine transition `[from, event, to]`; an empty `to` leaves the parent. */
export type StateTransition = [from: string, event: string, to: string];

export class StateChartIndex {
  statechart: StateChart;
  _chartsIndex: Record<string, StateChart> = {};
  _nodesIndex: Record<string, StateGraphNode> = {};
  _nodesParentsIndex: Record<string, string> = {};
  _edgeIndex: Record<string, StateGraphEdge> = {};
  _edgesParentsIndex: Record<string, string> = {};
  initialStateKey: string;
  finalStateKey: string;

  constructor({
    statechart,
    ...override
  }: {
    statechart: StateChart;
    /** @deprecated The key recorded on `statechart` when it was built is used. */
    initialStateKey?: string;
    /** @deprecated The key recorded on `statechart` when it was built is used. */
    finalStateKey?: string;
  }) {
    this.statechart = statechart;
    const { initialStateKey, finalStateKey } = getPseudoStateKeys(statechart, override);
    this.initialStateKey = initialStateKey;
    this.finalStateKey = finalStateKey;

    this._buildIndexes();
  }

  /**
   * Returns a state node or a chart by the specified identifier.
   * @param id the id of a state node or a chart
   * @returns a state node or a chart
   */
  getNodeById(id: string): StateGraphNode | undefined {
    return this._nodesIndex[id] || this._chartsIndex[id];
  }

  /**
   * Returns a chart by the specified identifier.
   * @param id the id of a state node or a chart
   * @returns a state node or a chart
   */
  getChartById(id: string): StateChart | undefined {
    return this._chartsIndex[id];
  }

  /**
   * Returns an edge by the specified identifier.
   * @param id the id of a graph edge
   * @returns a graph edge
   */
  getEdgeById(id: string): StateGraphEdge | undefined {
    return this._edgeIndex[id];
  }

  /**
   * Returns a list of all nodes in this chart.
   * @return a list of all nodes
   */
  getAllNodes(): StateGraphNode[] {
    return [...new Set([...Object.values(this._chartsIndex), ...Object.values(this._nodesIndex)])];
  }

  /**
   * Returns a list of all non-empty state nodes in this chart.
   * The result excludes nodes for initial and fina states.
   * @return a list of all non-empty state nodes
   */
  getStateNodes(): StateGraphNode[] {
    return this.getAllNodes().filter(
      (node) => node.key !== this.initialStateKey && node.key !== this.finalStateKey,
    );
  }

  /**
   * Transforms a stack of state keys to the corresponding identifiers.
   * If a key in the stack was not found then this method returns
   * an empty stack.
   * @param stack a stack of state keys
   * @returns a stack of state identifiers for the given states
   */
  getStatesIds(...stack: string[]): string[] {
    const result = [];
    let list = [this.statechart] as (StateChart | StateGraphNode)[];
    for (let i = 0; list?.length > 0 && i < stack.length; i++) {
      const key = stack[i];
      const node = list.find((node) => node.key === key);
      if (!node) break;
      result.push(node.id);
      list = [...(node.children || []), ...(node.nodes || [])];
    }
    return result.length === stack.length ? result : [];
  }

  /**
   * Returns graph nodes for the specified identifier.
   * @param id the id of a  node
   * @returns a stack of nodes
   */
  getStackByStateId(id?: string): StateGraphNode[] {
    if (!id) return [];
    const node = this._chartsIndex[id] || this._nodesIndex[id];
    if (!node) return [];
    const parentId = this._nodesParentsIndex[id];
    if (parentId) {
      const parentStack = this.getStackByStateId(parentId);
      if (!parentStack.length) return [];
      parentStack.push(node);
      return parentStack;
    } else {
      return [node];
    }
  }

  /**
   * Returns an edge object corresponding to the transition from the state
   * @param stateId identifier of the source state
   * @param event an event triggering the transition
   * @returns graph edge
   */
  getTransition(stateId?: string, event?: string): StateGraphEdge | undefined {
    const stack = this.getStackByStateId(stateId);
    const state = stack.pop();
    if (!state || !stack.length) return;
    const parent = stack[stack.length - 1];
    const t = parent.edges.find((t: StateGraphEdge) => t.from === state.key && t.event === event);
    return t;
  }

  /**
   * Returns a list of edge objects corresponding to all transitions from the state
   * @param stateId identifier of the source state
   * @returns a list of graph edges
   */
  getTransitions(stateId?: string): StateGraphEdge[] {
    const stack = this.getStackByStateId(stateId);
    const state = stack.pop();
    if (!state || !stack.length) return [];
    const parent = stack[stack.length - 1];
    return parent.edges.filter((t: StateGraphEdge) => t.from === state.key);
  }

  /**
   * Returns the edge drawn for the engine transition `[state.key, event, to]` from
   * the specified state: the edge leaving the state itself or, failing that, the
   * edge of a wildcard (`"*"`) source rule. An empty `to` is the final state.
   * @param stateId identifier of the source state
   * @param event an event triggering the transition
   * @param to the key of the target state
   * @returns graph edge
   */
  findTransition(
    stateId: string | undefined,
    event: string,
    to: string,
  ): StateGraphEdge | undefined {
    const stack = this.getStackByStateId(stateId);
    const state = stack.pop();
    if (!state || !stack.length) return;
    const parent = stack[stack.length - 1];
    const target = to || this.finalStateKey;
    const find = (from: string) =>
      parent.edges.find(
        (t: StateGraphEdge) => t.from === from && t.event === event && t.to === target,
      );
    return find(state.key) || find("*");
  }

  /**
   * Maps engine transitions to the edges drawn for them, for the active stack of
   * state keys `stack` (root first). Each `[from, event, to]` — as listed by
   * `getStateTransitions` of `@statewalker/fsm` — is matched in the chart of the
   * level where `from` is the active state, by the state's own edge or by the
   * edge of a wildcard (`"*"`) source rule; an empty `to` is the final state.
   * Tuples that match no drawn edge are skipped, so the result never holds more
   * edges than the engine reports.
   * @param stack the active stack of state keys, root first
   * @param transitions the enabled transitions, as the engine reports them
   * @returns the matching graph edges
   */
  getTransitionEdges(stack: string[], transitions: StateTransition[]): StateGraphEdge[] {
    const idsStack = this.getStatesIds(...stack);
    const pending = new Set(transitions);
    const edges: StateGraphEdge[] = [];
    for (let i = idsStack.length - 1; i > 0; i--) {
      for (const t of pending) {
        const [from, event, to] = t;
        if (from !== stack[i]) continue;
        const edge = this.findTransition(idsStack[i], event, to);
        if (!edge) continue;
        edges.push(edge);
        pending.delete(t);
      }
    }
    return edges;
  }

  /**
   * Returns a graph node corresponding to the specified state id.
   * @param stateId identifier of the state
   * @returns graph node
   * @see getStateChart
   */
  getStateNode(stateId?: string): StateGraphNode | undefined {
    return stateId ? this._nodesIndex[stateId] : undefined;
  }

  /**
   * Returns a chart corresponding to the specified state id.
   * @param stateId identifier of the state
   * @returns graph node
   * @see getStateNode
   */
  getStateChart(stateId?: string): StateChart | undefined {
    return stateId ? this._chartsIndex[stateId] : undefined;
  }

  /**
   * Returns ids of the previous and next state for the specified transition
   * @param transition a graph edge instance defining transition
   * @returns an array with two identifiers - [sourceStateId, targetStateId] - the source state id and target state id
   */
  getTransitionStateIds(transition?: StateGraphEdge): [string | undefined, string | undefined] {
    const result: [string | undefined, string | undefined] = [undefined, undefined];
    if (!transition) return result;
    const parentId = this._edgesParentsIndex[transition.id];
    if (!parentId) return result;
    const parent = this._chartsIndex[parentId];
    if (!parent) return result;
    parent.nodes.forEach((node: StateGraphNode) => {
      if (node.key === transition.from) {
        result[0] = node.id;
      }
      if (node.key === transition.to) {
        result[1] = node.id;
      }
    });
    return result;
  }

  // ----------------------------------------------------------
  // Internal methods
  _buildIndexes() {
    const addToIndex = (chart: StateChart) => {
      const chartId = chart.id;
      this._chartsIndex[chartId] = chart;
      if (!(chartId in this._nodesIndex)) {
        this._nodesIndex[chartId] = chart;
      }
      chart.nodes.forEach((node) => {
        const nodeId = node.id;
        this._nodesIndex[nodeId] = node;
        this._nodesParentsIndex[nodeId] = chartId;
      });
      chart.edges.forEach((edge) => {
        const edgeId = edge.id;
        this._edgeIndex[edgeId] = edge;
        this._edgesParentsIndex[edgeId] = chartId;
      });
      (chart.children || []).forEach((child) => {
        this._nodesParentsIndex[child.id] = chartId;
        addToIndex(child);
      });
    };
    addToIndex(this.statechart);
  }
}
