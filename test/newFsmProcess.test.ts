import type { FsmStateConfig } from "../src/index.js";
import { newFsmProcess } from "../src/index.js";
import { describe, expect, it } from "./deps.js";

describe("newFsmProcess", () => {
  it("should return 'dispatch' method allowing to run process", async () => {
    const config = {
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
            ["UpdateSelection", "error", ""],
            ["UpdateSelection", "select", "Wait"],
          ],
        },
      ],
    } as FsmStateConfig;
    const stack: string[] = [];
    const traces: string[] = [];
    const context = {};
    const [dispatch] = newFsmProcess(context, config, (state, event) => {
      return () => {
        const prefix = stack.map(() => "  ").join("");
        stack.push(state);
        traces.push(`${prefix}<${state} event="${event}">`);
        return () => {
          traces.push(`${prefix}</${state}>`);
          stack.pop();
        };
      };
    });

    expect(stack).toEqual([]);
    expect(traces).toEqual([]);
    await dispatch("start");
    expect(stack).toEqual(["Selection", "Wait"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "Wait"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "UpdateSelection"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
    ]);

    await dispatch("select");
    expect(stack).toEqual(["Selection", "Selected", "Wait"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      '    <Wait event="select">',
    ]);

    await dispatch("error");
    expect(stack).toEqual(["Selection", "HandleError"]);
    expect(traces).toEqual([
      '<Selection event="start">',
      '  <Wait event="start">',
      "  </Wait>",
      '  <Selected event="select">',
      '    <Wait event="select">',
      "    </Wait>",
      '    <UpdateSelection event="select">',
      "    </UpdateSelection>",
      '    <Wait event="select">',
      "    </Wait>",
      "  </Selected>",
      '  <HandleError event="error">',
    ]);
  });

  return it("should handle async generator handlers triggering transitions", async () => {
    const config = {
      key: "TimerProcess",
      transitions: [
        ["", "*", "Idle"],
        ["Idle", "tick", "Running"],
        ["Running", "tick", "Running"],
        ["Running", "stop", "Idle"],
        ["*", "exit", ""],
      ],
    } as FsmStateConfig;

    const traces: string[] = [];
    type ContextWithTicker = {
      tickCount: number;
    };
    const context: ContextWithTicker = { tickCount: 0 };

    // Helper to create async generator that emits events
    async function* createTicker(context: ContextWithTicker) {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        context.tickCount++;
        yield "tick";
      }
      yield "stop";
    }

    const [dispatch] = newFsmProcess(context, config, (state, event) => {
      if (state === "TimerProcess") {
        return (ctx: ContextWithTicker) => {
          traces.push(`Starting ticker in ${state}`);
          return createTicker(ctx);
        };
      }
      return () => {
        traces.push(`Enter ${state} with event ${event}`);
        return () => {
          traces.push(`Exit ${state}`);
        };
      };
    });

    await dispatch("start");
    expect(traces).toContain("Enter Idle with event start");
    // await new Promise((resolve) => setTimeout(resolve, 30));

    // await dispatch("start");
    expect(traces).toContain("Starting ticker in TimerProcess");

    // Wait for async generator to complete
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(context.tickCount).toBe(3);
    console.log(traces);
    expect(traces).toContain("Enter Idle with event stop");
    expect(traces).toEqual([
      "Starting ticker in TimerProcess",
      "Enter Idle with event start",
      "Exit Idle",
      "Enter Running with event tick",
      "Exit Running",
      "Enter Running with event tick",
      "Exit Running",
      "Enter Running with event tick",
      "Exit Running",
      "Enter Idle with event stop",
    ]);
  });
  /* * /
  it("should handle multiple async generators in different states", async () => {
    const config = {
      key: "MultiGenProcess",
      transitions: [
        ["", "*", "StateA"],
        ["StateA", "next", "StateB"],
        ["StateB", "finish", "StateC"],
        ["StateC", "reset", "StateA"],
        ["*", "exit", ""],
      ],
    } as FsmStateConfig;

    const events: string[] = [];
    const context = { generatorACount: 0, generatorBCount: 0 };

    async function* generatorA(ctx: any) {
      for (let i = 0; i < 2; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        ctx.generatorACount++;
        yield "next";
      }
    }

    async function* generatorB(ctx: any) {
      await new Promise((resolve) => setTimeout(resolve, 15));
      ctx.generatorBCount++;
      yield "finish";
    }

    const [dispatch] = newFsmProcess(context, config, (state, event) => {
      events.push(`${state}:${event}`);

      if (state === "StateA" && event === "start") {
        return (ctx: any) => generatorA(ctx);
      }

      if (state === "StateB" && event === "next") {
        return (ctx: any) => generatorB(ctx);
      }

      return () => {}; // No-op handler
    });

    await dispatch("start");

    // Wait for async generators to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(context.generatorACount).toBe(2);
    expect(context.generatorBCount).toBe(1);
    expect(events).toContain("StateA:start");
    expect(events).toContain("StateB:next");
    expect(events).toContain("StateC:finish");
  });

  it("should properly cleanup async generators on state exit", async () => {
    const config = {
      key: "CleanupProcess",
      transitions: [
        ["", "*", "Active"],
        ["Active", "interrupt", "Stopped"],
        ["Stopped", "resume", "Active"],
        ["*", "exit", ""],
      ],
    } as FsmStateConfig;

    let generatorCleanedUp = false;
    const context = { eventCount: 0 };

    async function* longRunningGenerator(ctx: any) {
      try {
        while (true) {
          await new Promise((resolve) => setTimeout(resolve, 20));
          ctx.eventCount++;
          yield "tick";
        }
      } finally {
        generatorCleanedUp = true;
      }
    }

    const [dispatch] = newFsmProcess(context, config, (state, event) => {
      if (state === "Active" && event === "start") {
        return (ctx: any) => longRunningGenerator(ctx);
      }
      return () => {};
    });

    await dispatch("start");

    // Let generator run for a bit
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(context.eventCount).toBeGreaterThan(0);

    // Interrupt the generator
    await dispatch("interrupt");

    // Give some time for cleanup
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(generatorCleanedUp).toBe(true);
  });

  it("should handle generator returning vs yielding events", async () => {
    const config = {
      key: "GeneratorReturnProcess",
      transitions: [
        ["", "*", "Start"],
        ["Start", "immediate", "Middle"],
        ["Middle", "delayed", "End"],
        ["*", "exit", ""],
      ],
    } as FsmStateConfig;

    const traces: string[] = [];

    // Generator that yields multiple events
    async function* multiEventGenerator() {
      yield "immediate";
      await new Promise((resolve) => setTimeout(resolve, 10));
      yield "delayed";
    }

    // Generator that returns a function (cleanup)
    function cleanupGenerator() {
      traces.push("Generator cleanup called");
      return () => {
        traces.push("Cleanup function executed");
      };
    }

    const [dispatch] = newFsmProcess({}, config, (state, event) => {
      traces.push(`Handler: ${state}:${event}`);

      if (state === "Start") {
        return multiEventGenerator;
      }

      if (state === "Middle") {
        return cleanupGenerator;
      }

      return () => {};
    });

    await dispatch("start");

    // Wait for async events
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(traces).toContain("Handler: Start:start");
    expect(traces).toContain("Handler: Middle:immediate");
    expect(traces).toContain("Handler: End:delayed");
    expect(traces).toContain("Generator cleanup called");
  });

  it("should handle errors in async generators gracefully", async () => {
    const config = {
      key: "ErrorProcess",
      transitions: [
        ["", "*", "Working"],
        ["Working", "error", "Error"],
        ["Error", "retry", "Working"],
        ["*", "exit", ""],
      ],
    } as FsmStateConfig;

    const traces: string[] = [];
    let errorCaught = false;

    async function* errorGenerator() {
      try {
        yield "error";
        throw new Error("Generator error");
      } catch (error) {
        errorCaught = true;
        traces.push("Error caught in generator");
      }
    }

    const [dispatch] = newFsmProcess({}, config, (state, event) => {
      traces.push(`${state}:${event}`);

      if (state === "Working" && event === "start") {
        return () => errorGenerator();
      }

      return () => {};
    });

    await dispatch("start");

    // Wait for async generator
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(traces).toContain("Working:start");
    expect(traces).toContain("Error:error");
    expect(errorCaught).toBe(true);
  });
  */
});
