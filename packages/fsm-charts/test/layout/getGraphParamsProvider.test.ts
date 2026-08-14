import { getGraphParamsProvider } from "../../src/layout/getGraphParamsProvider.js";
import { describe, expect, it } from "../deps.js";

describe("getGraphParamsProvider", () => {
  it("should return functions that return dimensions and parameters for state node and transitions", () => {
    const result = getGraphParamsProvider({
      stateFontSize: 14,
      stateTextPadding: 3,
      transitionsFontSize: 12,
      transitionsTextPadding: 3,
    });
    const expected = {
      getStateParams: expect.any(Function),
      getTransitionParams: expect.any(Function),
    };
    expect(result).toEqual(expected);
  });
});

describe("getGraphParamsProvider#getStateParams", () => {
  it("should allow to calculate empty state dimensions without padding", () => {
    const { getStateParams } = getGraphParamsProvider({
      stateFontSize: 14,
      stateTextPadding: 0,
    });
    const result = getStateParams("<initial>", "");
    expect(result).toEqual({
      fontSize: 14,
      key: "<initial>",
      state: "",
      text: "",
      width: 0,
      height: 14,
      padding: [0, 0, 0, 0],
    });
  });
  it("should allow to calculate empty state dimensions with padding", () => {
    const { getStateParams } = getGraphParamsProvider({
      stateFontSize: 14,
      stateTextPadding: [0, 3],
    });
    const result = getStateParams("<initial>", "");
    expect(result).toEqual({
      key: "<initial>",
      state: "",
      text: "",
      width: 6,
      height: 14,
      fontSize: 14,
      padding: [0, 3, 0, 3],
    });
  });
  it("should allow to calculate state dimensions without padding", () => {
    const { getStateParams } = getGraphParamsProvider({
      stateFontSize: 14,
      stateTextPadding: 0,
    });
    const result = getStateParams("a");
    const expected = {
      key: "a",
      state: "a",
      text: "a",
      width: 9,
      height: 14,
      fontSize: 14,
      padding: [0, 0, 0, 0],
    };
    expect(result).toEqual(expected);
  });

  it("should allow to calculate state dimensions with padding", () => {
    const { getStateParams } = getGraphParamsProvider({
      stateFontSize: 14,
      stateTextPadding: 3,
    });
    const result = getStateParams("a");
    const expected = {
      key: "a",
      state: "a",
      text: "a",
      width: 15,
      height: 20,
      fontSize: 14,
      padding: [3, 3, 3, 3],
    };
    expect(result).toEqual(expected);
  });

  it("should calculate state dimensions with custom labels", () => {
    const { getStateParams } = getGraphParamsProvider({
      stateFontSize: 14,
      stateTextPadding: 3,
      getStateLabel: (state: string) => `[${state.toUpperCase()}]`,
    });
    const result = getStateParams("a");
    const expected = {
      key: "a",
      state: "a",
      text: "[A]",
      width: 32,
      height: 20,
      fontSize: 14,
      padding: [3, 3, 3, 3],
    };
    expect(result).toEqual(expected);
  });
});

describe("getGraphParamsProvider#getTransitionParams", () => {
  it("should allow to calculate empty transition dimensions without padding", () => {
    const { getTransitionParams } = getGraphParamsProvider({
      transitionsFontSize: 14,
      transitionsTextPadding: 0,
    });
    const result = getTransitionParams("", "", "");
    expect(result).toEqual({
      from: "",
      fontSize: 14,
      event: "",
      to: "",
      text: "",
      width: 0,
      height: 14,
      padding: [0, 0, 0, 0],
    });
  });
  it("should allow to calculate empty event dimensions with padding", () => {
    const { getTransitionParams } = getGraphParamsProvider({
      transitionsFontSize: 14,
      transitionsTextPadding: [0, 3],
    });
    const result = getTransitionParams("", "", "");
    expect(result).toEqual({
      from: "",
      event: "",
      fontSize: 14,
      to: "",
      text: "",
      width: 6,
      height: 14,
      padding: [0, 3, 0, 3],
    });
  });
  it("should allow to calculate not-empty transition dimensions without padding", () => {
    const { getTransitionParams } = getGraphParamsProvider({
      transitionsFontSize: 14,
      transitionsTextPadding: 0,
    });
    const result = getTransitionParams("a", "b", "c");
    const expected = {
      from: "a",
      event: "b",
      to: "c",
      text: "b",
      width: 9,
      height: 14,
      fontSize: 14,
      padding: [0, 0, 0, 0],
    };
    expect(result).toEqual(expected);
  });
  it("should allow to calculate not-empty transition dimensions with padding", () => {
    const { getTransitionParams } = getGraphParamsProvider({
      transitionsFontSize: 14,
      transitionsTextPadding: [0, 3],
    });
    const result = getTransitionParams("a", "b", "c");
    const expected = {
      from: "a",
      event: "b",
      to: "c",
      text: "b",
      width: 15,
      height: 14,
      fontSize: 14,
      padding: [0, 3, 0, 3],
    };
    expect(result).toEqual(expected);
  });
  it("should calculate transitions dimensions with custom labels", () => {
    const { getTransitionParams } = getGraphParamsProvider({
      transitionsFontSize: 14,
      transitionsTextPadding: [0, 3],
      getTransitionLabel: (from, event, to) => `[${from}:${event}:${to}]`,
    });
    const result = getTransitionParams("a", "b", "c");
    const expected = {
      from: "a",
      event: "b",
      to: "c",
      text: "[a:b:c]",
      width: 67,
      height: 14,
      fontSize: 14,
      padding: [0, 3, 0, 3],
    };
    expect(result).toEqual(expected);
  });
});
