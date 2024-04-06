import { describe, it, expect } from "./deps.js";
import {
  buildStateDescriptor,
  getTargetStateKey,
  getAllStateKeys,
} from "../src/index.js";

const config = {
  key: "MAIN",
  foo: "Foo",
  bar: "Bar",
  transitions: [
    ["*", "*", "LOGIN", { message: "Hello" }],
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

describe("buildStateDescriptor", () => {
  it("buildDescriptor: should build descriptors from configuration", () => {
    const d = buildStateDescriptor(config);
    expect(typeof d).toBe("object");
  });

  it("buildDescriptor: should provide access to configuration options", () => {
    const d = buildStateDescriptor(config);
    expect(d.key).toEqual("MAIN");
    expect(d.options).toEqual({ foo: "Foo", bar: "Bar" });
  });

  it("buildDescriptor: should provide transtitions index", () => {
    const d = buildStateDescriptor(config);
    expect(d.transitions).toEqual({
      "*": { "*": "LOGIN", byebye: "END_SCREEN" },
      END_SCREEN: { "*": "" },
      LOGIN: { error: "BAD_LOGIN_VIEW", ok: "MAIN_VIEW" },
      MAIN_VIEW: { "*": "MAIN_VIEW" },
    });
  });

  it("getAllStateKeys: should give access to all state keys", () => {
    const d = buildStateDescriptor(config);
    const substateKeys = getAllStateKeys(d);
    const control = [
      "",
      "*",
      "BAD_LOGIN_VIEW",
      "END_SCREEN",
      "FORM",
      "LOGIN",
      "MAIN",
      "MAIN_VIEW",
      "PAGE_EDIT",
      "PAGE_UPDATED_MESSAGE",
      "PAGE_VIEW",
      "SHOW_FORM",
      "SHOW_FORM_ERRORS",
      "VALIDATE_FORM",
    ];
    expect(substateKeys).toEqual(control);
  });

  it("getTargetStateKey: should provide information about transitions", () => {
    const d = buildStateDescriptor(config);
    let key = getTargetStateKey(d, "LOGIN", "error");
    expect(key).toEqual("BAD_LOGIN_VIEW");
    key = getTargetStateKey(d, "LOGIN", "ok");
    expect(key).toEqual("MAIN_VIEW");
  });
});
