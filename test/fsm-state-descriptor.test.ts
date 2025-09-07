import { type FsmStateConfig, FsmStateDescriptor } from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";

const config: FsmStateConfig = {
  key: "MAIN",
  transitions: [
    ["*", "*", "LOGIN"],
    ["LOGIN", "error", "BAD_LOGIN_VIEW"],
    ["LOGIN", "ok", "MAIN_VIEW"],
    ["MAIN_VIEW", "*", "MAIN_VIEW"],
    ["*", "byebye", "END_SCREEN"],
    ["END_SCREEN", "*", ""],
  ],
  states: [
    {
      key: "LOGIN",
      transitions: [["", "*", "FORM"]],
    },
    {
      key: "MAIN_VIEW",
      transitions: [
        ["*", "*", "PAGE_VIEW"],
        ["*", "logout", ""],
        ["PAGE_VIEW", "edit", "PAGE_EDIT"],
        ["PAGE_EDIT", "ok", "PAGE_UPDATED_MESSAGE"],
      ],
      states: [
        {
          key: "PAGE_EDIT",
          transitions: [["", "*", "FORM"]],
        },
      ],
    },

    {
      key: "FORM",
      transitions: [
        ["", "*", "SHOW_FORM"],
        ["SHOW_FORM", "*", "VALIDATE_FORM"],
        ["SHOW_FORM", "cancel", ""],
        ["VALIDATE_FORM", "ok", ""],
        ["VALIDATE_FORM", "*", "SHOW_FORM_ERRORS"],
        ["SHOW_FORM_ERRORS", "*", "SHOW_FORM"],
        ["SHOW_FORM_ERRORS", "cancel", ""],
      ],
    },
  ],
};

describe("FsmStateDescriptor", () => {
  it("should build descriptors from configuration", () => {
    const d = FsmStateDescriptor.build(config);
    expect(typeof d).toBe("object");
  });

  it("buildDescriptor: should provide transtitions index", () => {
    const d = FsmStateDescriptor.build(config);
    expect(d.transitions).toEqual({
      "*": { "*": "LOGIN", byebye: "END_SCREEN" },
      END_SCREEN: { "*": "" },
      LOGIN: { error: "BAD_LOGIN_VIEW", ok: "MAIN_VIEW" },
      MAIN_VIEW: { "*": "MAIN_VIEW" },
    });
  });

  // it("getAllStateKeys: should give access to all state keys", () => {
  //   const d = FsmStateDescriptor.build(config);
  //   const substateKeys = d.getAllStateKeys(d);
  //   const control = [
  //     "",
  //     "*",
  //     "BAD_LOGIN_VIEW",
  //     "END_SCREEN",
  //     "FORM",
  //     "LOGIN",
  //     "MAIN",
  //     "MAIN_VIEW",
  //     "PAGE_EDIT",
  //     "PAGE_UPDATED_MESSAGE",
  //     "PAGE_VIEW",
  //     "SHOW_FORM",
  //     "SHOW_FORM_ERRORS",
  //     "VALIDATE_FORM",
  //   ];
  //   expect(substateKeys).toEqual(control);
  // });

  it("getTargetStateKey: should provide information about transitions", () => {
    const d = FsmStateDescriptor.build(config);
    let key = d.getTargetStateKey("LOGIN", "error");
    expect(key).toEqual("BAD_LOGIN_VIEW");
    key = d.getTargetStateKey("LOGIN", "ok");
    expect(key).toEqual("MAIN_VIEW");
  });
});
