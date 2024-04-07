import { describe, it, expect } from "./deps.js";
import { FsmProcess, FsmState, FsmStateConfig } from "../src/index.js";

describe("FsmAsyncProcess", () => {
  const main: FsmStateConfig = {
    key: "MAIN",
    transitions: [
      ["", "*", "LOGIN"],
      ["LOGIN", "ok", "MAIN_VIEW"],
      ["MAIN_VIEW", "*", "MAIN_VIEW"],
      ["MAIN_VIEW", "logout", "LOGIN"],
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

  const options = {
    config: main,
    events: [
      // Start application
      "",
      // Login session
      "submit",
      "error",
      "ok",
      "submit",
      "ok",
      // Main state
      "tto",
      // Edit
      "edit",
      "submit",
      "ok",
      // Close the result message
      "ok",
      // Exit from the main view
      "logout",
    ],
    control: [
      "-[]->MAIN/LOGIN/FORM/SHOW_FORM",
      "-[submit]->MAIN/LOGIN/FORM/VALIDATE_FORM",
      "-[error]->MAIN/LOGIN/FORM/SHOW_FORM_ERRORS",
      "-[ok]->MAIN/LOGIN/FORM/SHOW_FORM",
      "-[submit]->MAIN/LOGIN/FORM/VALIDATE_FORM",
      "-[ok]->MAIN/MAIN_VIEW/PAGE_VIEW",
      "-[tto]->MAIN/MAIN_VIEW/PAGE_VIEW",
      "-[edit]->MAIN/MAIN_VIEW/PAGE_EDIT/FORM/SHOW_FORM",
      "-[submit]->MAIN/MAIN_VIEW/PAGE_EDIT/FORM/VALIDATE_FORM",
      "-[ok]->MAIN/MAIN_VIEW/PAGE_UPDATED_MESSAGE",
      "-[ok]->MAIN/MAIN_VIEW/PAGE_VIEW",
      "-[logout]->MAIN/LOGIN/FORM/SHOW_FORM",
    ],
    traces: [
      '  <MAIN event="">',
      '    <LOGIN event="">',
      '      <FORM event="">',
      '        <SHOW_FORM event="">',
      "         [SHOW_FORM:]",
      "        </SHOW_FORM>",
      '        <VALIDATE_FORM event="submit">',
      "         [VALIDATE_FORM:submit]",
      "        </VALIDATE_FORM>",
      '        <SHOW_FORM_ERRORS event="error">',
      "         [SHOW_FORM_ERRORS:error]",
      "        </SHOW_FORM_ERRORS>",
      '        <SHOW_FORM event="ok">',
      "         [SHOW_FORM:ok]",
      "        </SHOW_FORM>",
      '        <VALIDATE_FORM event="submit">',
      "         [VALIDATE_FORM:submit]",
      "        </VALIDATE_FORM>",
      "      </FORM>",
      "    </LOGIN>",
      '    <MAIN_VIEW event="ok">',
      '      <PAGE_VIEW event="ok">',
      "       [PAGE_VIEW:ok]",
      "      </PAGE_VIEW>",
      '      <PAGE_VIEW event="tto">',
      "       [PAGE_VIEW:tto]",
      "      </PAGE_VIEW>",
      '      <PAGE_EDIT event="edit">',
      '        <FORM event="edit">',
      '          <SHOW_FORM event="edit">',
      "           [SHOW_FORM:edit]",
      "          </SHOW_FORM>",
      '          <VALIDATE_FORM event="submit">',
      "           [VALIDATE_FORM:submit]",
      "          </VALIDATE_FORM>",
      "        </FORM>",
      "      </PAGE_EDIT>",
      '      <PAGE_UPDATED_MESSAGE event="ok">',
      "       [PAGE_UPDATED_MESSAGE:ok]",
      "      </PAGE_UPDATED_MESSAGE>",
      '      <PAGE_VIEW event="ok">',
      "       [PAGE_VIEW:ok]",
      "      </PAGE_VIEW>",
      "    </MAIN_VIEW>",
      '    <LOGIN event="logout">',
      '      <FORM event="logout">',
      '        <SHOW_FORM event="logout">',
      "         [SHOW_FORM:logout]",
    ],
  };

  function newProcess(print: (msg: string) => void): FsmProcess {
    let process: FsmProcess;
    const onEnter = (process: FsmProcess) => {
      const state = process.state;
      const eventKey = process.event;
      print(`<${state?.key} event="${eventKey}">`);
    };
    const onExit = (process: FsmProcess) => {
      print(`</${process.state?.key}>`);
    };
    const newStatePrinter = (state: FsmState) => {
      return (msg: string) => {
        let shift = "";
        for (let s: FsmState | undefined = state; !!s; s = s.parent) {
          shift += "  ";
        }
        console.log(`${shift}${msg}`);
      };
    };
    process = new FsmProcess({
      root: options.config,
      onEnter,
      onExit,
      onActivate: (state: FsmState) => {
        const printer = newStatePrinter(state);
        state.init(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          printer(`<${state.key}>`);
        });
        state.done(() => printer(`</${state.key}>`));
      },
    });
    return process;
  }

  it("should iterate over states and perform required state transitions", async () => {
    const testTraces: string[] = [];
    const print = (msg: string) => {
      let shift = "";
      for (let state = process.state; !!state; state = state.parent) {
        shift += "  ";
      }
      testTraces.push(shift + msg);
    };
    const getPath = () => {
      const stack: string[] = [];
      for (let state = process.state; !!state; state = state.parent) {
        stack.unshift(state.key);
      }
      return stack.join("/");
    };
    const getStateKey = () => process.state?.key || "";
    const getEventKey = () => process.event || "";
    const process = newProcess(print);

    const { events, control, traces } = options;
    const test = [];
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      await process.dispatch(event);

      const stateKey = getStateKey();
      const eventKey = getEventKey();
      test.push(`-[${eventKey}]->${getPath()}`);
      print(` [${stateKey}:${eventKey}]`);
    }
    expect(test).toEqual(control);
    expect(testTraces).toEqual(traces);
  });
});
