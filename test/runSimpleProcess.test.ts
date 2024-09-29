import { describe, it, expect } from "./deps.ts";
import { FsmProcess, FsmStateConfig } from "../src/index.ts";
import { setProcessTracer } from "../src/utils/tracer.ts";
import { setProcessPrinter } from "../src/utils/printer.ts";

describe("simple processing", () => {
  const config: FsmStateConfig = {
    key: "App",
    transitions: [
      ["", "*", "CheckExists"],
      ["CheckExists", "no", "Download"],
      ["CheckExists", "yes", "Process"],
      ["Download", "ok", "Process"],
      ["*", "error", "HandleError"],
      ["HandleError", "*", ""],
    ],
  };

  function newPrintChecker() {
    const lines: any[][] = [];
    return [
      (...args: any[]) => {
        // console.log(args.join(""));
        lines.push(args);
      },
      (...control: any[][]) => {
        expect(lines.map((items) => items.join(""))).toEqual(control);
      },
    ];
  }

  const [addTraces, checkTraces] = newPrintChecker();

  async function run(...events: string[]) {
    const process = new FsmProcess(config);
    setProcessPrinter(process, {
      print: console.log, // addTraces,
      lineNumbers: false,
    });
    setProcessTracer(process);

    for (const event of events) {
      await process.dispatch(event);
    }
  }

  it("should...", async () => {
    run("", "yes", "ok", "error", "ok");
  });
});
