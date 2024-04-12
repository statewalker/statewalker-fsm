import { describe, it, expect } from "./deps.ts";
import { FsmProcess, FsmState, FsmStateConfig } from "../src/index.js";
import { FsmProcessDump } from "../dist/index";
import { getPrinter, setPrinter } from "./composite/context.printer.ts";

function addTracer() {
  return (process: FsmProcess) => {
    // process.onStateCreate((state) => {
    //   const print = getPrinter(state);
    //   state.onEnter(() => {
    //     print(`<${state?.key} event="${state.process.event}">`);
    //   });
    //   state.onExit(() => {
    //     print(`</${state.key}> <!-- event="${state.process.event}" -->`);
    //   });
    // });
  };
}

describe("dump/restore: process is dumped and restored at each step", () => {
  const config: FsmStateConfig = {
    key: "Selection",
    transitions: [
      ["*", "exit", ""],
      ["*", "*", "Wait"],
      ["Wait", "select", "Selected"],
      ["*", "error", "HandleError"],
      ["HandleError", "*", "Wait"],
    ],
    states: [
      {
        key: "Selected",
        transitions: [
          ["", "*", "Wait"],
          ["Wait", "select", "UpdateSelection"],
          ["UpdateSelection", "*", "Wait"],
        ],
      },
    ],
  };

  function newPrintChecker() {
    const lines: any[][] = [];
    return [
      (...args: any[]) => {
        lines.push(args);
      },
      (...control: any[][]) => {
        expect(lines.map((items) => items.join(""))).toEqual(control);
      },
    ];
  }

  let dump: FsmProcessDump | undefined;
  let stepId = 0;
  const [addTraces, checkTraces] = newPrintChecker();
  const addLogger = (state: FsmState) => {
    const print = getPrinter(state);
    state.onEnter(() => {
      print(`<${state?.key} event="${state.process.event}">`);
    });
    state.onExit(() => {
      print(`</${state.key}> <!-- event="${state.process.event}" -->`);
    });
  };

  let dumped: string[] = [];
  let restored: string[] = [];
  let control: any[] = [];

  async function run(...events: string[]) {
    const process = new FsmProcess(config);

    process.onStateCreate((state: FsmState) => {
      if (state.key === "Selection") {
        setPrinter(state, {
          prefix: "",
          lineNumbers: false,
          print: addTraces,
        });
      }
      state.dump((state, data) => {
        dumped.push(`${state.key}:${stepId}`);
        data.stepId = stepId;
      });
      state.restore((state, data) => {
        restored.push(`${state.key}:${data.stepId}`);
      });
      addLogger(state);
    });

    if (dump) await process.restore(dump);
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      let ok = await process.dispatch(event);
      if (!process.state) break;
      // await process.running;

      const print = getPrinter(process.state);
      print(`step ${++stepId}`);
      if (!ok) break;
    }
    dump = await process.dump();
  }

  it("process starts and runs while event is defined", async () => {
    expect(dumped).toEqual([]);
    expect(restored).toEqual([]);
    await run("");
    control.push('<Selection event="">', '  <Wait event="">', "  step 1");
    checkTraces(...control);
    expect(dump).toEqual({
      status: 4,
      event: "",
      stack: [
        {
          key: "Selection",
          data: {
            stepId: 1,
          },
        },
        {
          key: "Wait",
          data: {
            stepId: 1,
          },
        },
      ],
    });
    expect(dumped).toEqual(["Selection:1", "Wait:1"]);
    expect(restored).toEqual([]);
    dumped = [];
    restored = [];
  });

  return;

  it("continue the process and stop at the embedded wait state cleaning events", async () => {
    await run("select");
    control.push(
      '  </Wait> <!-- event="select" -->',
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    step 2"
    );
    checkTraces(...control);
    expect(restored).toEqual(["Selection:1", "Wait:1"]);
    expect(dumped).toEqual(["Selection:2", "Selected:2", "Wait:2"]);
    dumped = [];
    restored = [];
  });

  it("the same event triggers an internal transition between sub-states", async () => {
    await run("select", "");
    control.push(
      '    </Wait> <!-- event="select" -->',
      '    <UpdateSelection event="select">',
      "    step 3",
      '    </UpdateSelection> <!-- event="" -->',
      '    <Wait event="">',
      "    step 4"
    );
    checkTraces(...control);
    expect(restored).toEqual(["Selection:2", "Selected:2", "Wait:2"]);
    // The step 3 is skipped
    expect(dumped).toEqual(["Selection:4", "Selected:4", "Wait:4"]);
    dumped = [];
    restored = [];
  });

  it("an event not defined in the sub-state moves the process to the parent state", async () => {
    await run("reset");
    control.push(
      '    </Wait> <!-- event="reset" -->',
      '  </Selected> <!-- event="reset" -->',
      '  <Wait event="reset">',
      "  step 5"
    );
    checkTraces(...control);
    expect(restored).toEqual(["Selection:4", "Selected:4", "Wait:4"]);
    expect(dumped).toEqual(["Selection:5", "Wait:5"]);
    dumped = [];
    restored = [];
  });

  it("check error handling", async () => {
    await run("error");
    control.push(
      '  </Wait> <!-- event="error" -->',
      '  <HandleError event="error">',
      // "  HANDLE ERROR",
      "  step 6"
    );
    checkTraces(...control);
    expect(restored).toEqual(["Selection:5", "Wait:5"]);
    expect(dumped).toEqual(["Selection:6", "HandleError:6"]);
    dumped = [];
    restored = [];
  });

  it("go to the internal wait state", async () => {
    await run("");
    control.push(
      '  </HandleError> <!-- event="" -->',
      '  <Wait event="">',
      "  step 7"
    );
    checkTraces(...control);
    expect(dump?.status).toEqual(4);
    expect(restored).toEqual(["Selection:6", "HandleError:6"]);
    expect(dumped).toEqual(["Selection:7", "Wait:7"]);
    dumped = [];
    restored = [];
  });

  it("check events handling not available in the transition descriptions", async () => {
    await run("toto");
    control.push(
      '  </Wait> <!-- event="toto" -->',
      '  <Wait event="toto">',
      "  step 8"
    );
    checkTraces(...control);
    expect(dump?.status).toEqual(4);
    expect(restored).toEqual(["Selection:7", "Wait:7"]);
    expect(dumped).toEqual(["Selection:8", "Wait:8"]);
    dumped = [];
    restored = [];
  });

  it("finalize process", async () => {
    await run("exit");
    control.push(
      '  </Wait> <!-- event="exit" -->',
      '</Selection> <!-- event="exit" -->'
      // "step 9"
    );
    checkTraces(...control);
    expect(dump?.status).toEqual(16); // FINISHED
    expect(dump).toEqual({
      event: "exit",
      stack: [],
      status: 16,
    });
    expect(restored).toEqual(["Selection:8", "Wait:8"]);
    expect(dumped).toEqual([]);
    dumped = [];
    restored = [];
  });
});
