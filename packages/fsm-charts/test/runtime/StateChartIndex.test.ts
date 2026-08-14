import { StateChartIndex } from "../../src/runtime/index.js";
import { process } from "../data/process.checkout.js";
import { describe, expect, it } from "../deps.js";
import { toStatechartsPanels } from "../html/toStatechartsPanels.js";

describe("StateChartIndex", () => {
  const { statechart } = toStatechartsPanels(process);
  const api = new StateChartIndex({ statechart });

  it("should return a list of state node ids for the specified non-terminal state keys", async () => {
    const stateIds = api.getStatesIds("App", "OpenFileSystem", "ChooseFolder");
    expect(stateIds.length).toEqual(3);
  });

  it("should return a list of state ids state keys containing terminal states", async () => {
    const stateKeys = ["App", "OpenFileSystem", "ChooseFolder", "A"];
    const stateIds = api.getStatesIds(...stateKeys);
    expect(stateIds.length).toEqual(stateKeys.length);
  });

  it("should return states and charts by their IDs", async () => {
    const stateKeys = ["App", "OpenFileSystem", "ChooseFolder", "A"];
    const stateIds = api.getStatesIds(...stateKeys);
    expect(stateIds.length).toBe(stateKeys.length);
    for (let i = 0; i < stateKeys.length; i++) {
      const stateKey = stateKeys[i];
      const stateId = stateIds[i];

      const state = api.getStateNode(stateId);
      expect(!!state).toBe(true);
      expect(state?.id).toBe(stateId);
      expect(state?.key).toBe(stateKey);

      if (i < stateKeys.length - 1) {
        const chart = api.getStateChart(stateId);
        expect(!!chart).toBe(true);
        expect(chart?.id).toBe(stateId);
        expect(chart?.key).toBe(stateKey);
      } else {
        const chart = api.getStateChart(stateId);
        expect(chart).toBe(undefined);
      }
    }
  });

  it("should return transition by state id and an event", async () => {
    const stateIds = api.getStatesIds("App", "OpenFileSystem", "ChooseFolder");
    const stateId = stateIds.pop() as string;
    const transition = api.getTransition(stateId, "ok");
    expect(transition !== undefined).toBe(true);
    expect(transition?.to).toEqual("CheckFolderAccess");
  });

  it("should return transition initial and target state ids", async () => {
    const stateIds = api.getStatesIds("App", "OpenFileSystem", "ChooseFolder");
    const transition = api.getTransition(stateIds.pop(), "ok");
    expect(transition !== undefined).toBe(true);

    const [fromId, toId] = api.getTransitionStateIds(transition);
    expect(!!fromId).toBe(true);
    expect(!!toId).toBe(true);

    expect(api.getStateNode(fromId)?.key).toBe("ChooseFolder");
    expect(api.getStateNode(toId)?.key).toBe("CheckFolderAccess");
  });

  it("should return a list of all transitions for a specific state id", async () => {
    const stateIds = api.getStatesIds(
      "App",
      "OpenFileSystem",
      "ChooseFolder",
      "A",
    );
    const stateId = stateIds.pop() as string;
    const transitions = api.getTransitions(stateId);
    expect(transitions !== undefined).toBe(true);
    expect(Array.isArray(transitions)).toBe(true);
    expect(transitions.length).toBe(2);
    expect(transitions[0].from).toEqual("A");
    expect(transitions[0].to).toEqual("B");
    expect(transitions[1].from).toEqual("A");
    expect(transitions[1].to).toEqual("C");
  });
});
