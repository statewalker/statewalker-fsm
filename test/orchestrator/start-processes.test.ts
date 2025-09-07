import path from "node:path";
import url from "node:url";
import { startProcesses } from "../../src/index.js";
import { describe, expect, it } from "../deps.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

async function delay(ms: number = 0): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}
describe("startNodeProcesses", () => {
  it("starts processes containing a single main-state handler", async () => {
    const modulePath = `${__dirname}/start-processes.module1.ts`;
    const traces: string[] = [];
    const parent = { traces };
    const close = await startProcesses({
      init: () => {
        return { parent };
      },
      modules: [modulePath],
    });
    expect(close).toBeInstanceOf(Function);
    expect(traces).toEqual([`Module1:enter`]);
    await delay(10);
    close();
    await delay(10);
    expect(traces).toEqual([`Module1:enter`, `Module1:exit`]);
  });

  it("starts a processes with multiple handlers", async () => {
    const modules = [`${__dirname}/start-processes.module2.ts`];
    const traces: string[] = [];
    const parent = { traces };
    function checkTraces(...control: string[]) {
      expect(traces.sort()).toEqual(control.sort());
    }
    const close = await startProcesses({
      init: () => {
        // Create a new context for this process
        // referencing the common parent context.
        return { parent };
      },
      modules,
    });
    expect(close).toBeInstanceOf(Function);
    await delay(10);
    checkTraces(`Module2-A:enter`, `Module2-B:enter`);
    close();
    await delay(10);
    checkTraces(
      `Module2-A:enter`,
      `Module2-B:enter`,
      `Module2-A:exit`,
      `Module2-B:exit`,
    );
  });

  it("starts multiple processes with multiple handlers", async () => {
    const modules = [
      `${__dirname}/start-processes.module1.ts`,
      `${__dirname}/start-processes.module2.ts`,
    ];
    const traces: string[] = [];
    const parent = { traces };
    function checkTraces(...control: string[]) {
      expect(traces.sort()).toEqual(control.sort());
    }
    const close = await startProcesses({
      init: () => {
        // Create a new context for this process
        // referencing the common parent context.
        return { parent };
      },
      modules,
    });
    expect(close).toBeInstanceOf(Function);
    await delay(10);
    checkTraces(`Module1:enter`, `Module2-A:enter`, `Module2-B:enter`);
    close();
    await delay(10);
    checkTraces(
      `Module1:enter`,
      `Module2-A:enter`,
      `Module2-B:enter`,
      `Module1:exit`,
      `Module2-A:exit`,
      `Module2-B:exit`,
    );
  });
});
