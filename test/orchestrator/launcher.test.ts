import { launcher } from "../../src/orchestrator/launcher.js";
import type { StageHandler } from "../../src/orchestrator/types.js";
import { describe, expect, it } from "../deps.js";
import { newAsyncGenerator } from "./new-async-generator.js";

async function delay(ms: number = 0): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

function newLogger(
  print: (...message: unknown[]) => void = console.log,
): StageHandler {
  let stepCounter = 0;
  let stateCounter = 0;
  return async (context: Record<string, unknown>) => {
    const stateId = String(stateCounter++).padStart(5, "0");
    const getInfo = () => {
      const stepId = String(stepCounter++).padStart(5, "0");
      const states = (context["fsm:states"] || []) as string[];
      const event = (context["fsm:event"] ?? "") as string;
      const prefix = states.map(() => "..").join("");
      return [
        `[${stepId}]${prefix}[${stateId}]`,
        states[states.length - 1],
        event,
      ];
    };
    const [prefix, state, event] = getInfo();
    print(`${prefix}<${state} event="${event}">`);
    return () => {
      const [prefix, state, event] = getInfo();
      print(`${prefix}</${state}><!-- event="${event}" -->`);
    };
  };
}

describe("launcher", () => {
  async function testProcessLauncher(
    getHandlers: (trigger: () => AsyncGenerator<string>) => (
      | StageHandler
      | {
          [state: string]: StageHandler | StageHandler[];
        }
    )[],
  ) {
    let resolve: () => void = () => {};
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    async function* testEventsGenerator() {
      yield* newAsyncGenerator<string>((next) => {
        (async () => {
          await delay();
          await next("select");
          await delay();
          await next("select");
          await delay();
          await next("select");
          await delay();
          await next("error");
          await delay();
          await next("ok");
          await delay();
          await next("select");
          resolve();
        })();
      });
    }
    const traces = [] as string[];
    const shutdown = await launcher(() => {
      return {
        start: ["TestApp"],
        // context: rootContext,
        processes: [
          {
            name: "TestApp",
            config: {
              key: "Selection",
              transitions: [
                ["*", "exit", ""],
                ["*", "*", "Wait"],
                ["Wait", "select", "Selected"],
                ["*", "error", "HandleError"],
                ["HandleError", "ok", "Wait"],
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
            },
            handlers: [
              newLogger((...message: unknown[]) => {
                traces.push(message.join(""));
              }),
              // ...getHandlers(testEventsGenerator),
            ],
          },
          // Additional handlers
          {
            name: "TestApp",
            handlers: getHandlers(testEventsGenerator),
          },
        ],
      };
    });
    await promise;
    await shutdown();
    expect(traces).toEqual([
      '[00000]..[00000]<Selection event="start">',
      '[00001]....[00001]<Wait event="start">',
      '[00002]....[00001]</Wait><!-- event="start" -->',
      '[00003]....[00002]<Selected event="select">',
      '[00004]......[00003]<Wait event="select">',
      '[00005]......[00003]</Wait><!-- event="select" -->',
      '[00006]......[00004]<UpdateSelection event="select">',
      '[00007]......[00004]</UpdateSelection><!-- event="select" -->',
      '[00008]......[00005]<Wait event="select">',
      '[00009]......[00005]</Wait><!-- event="select" -->',
      '[00010]....[00002]</Selected><!-- event="error" -->',
      '[00011]....[00006]<HandleError event="error">',
      '[00012]....[00006]</HandleError><!-- event="error" -->',
      '[00013]....[00007]<Wait event="ok">',
      '[00014]....[00007]</Wait><!-- event="ok" -->',
      '[00015]....[00008]<Selected event="select">',
      '[00016]......[00009]<Wait event="select">',
      '[00017]......[00009]</Wait><!-- event="select" -->',
      '[00018]....[00008]</Selected><!-- event="" -->',
      '[00019]..[00000]</Selection><!-- event="" -->',
    ]);
  }

  it("should bind event dispatcher to the process with the 'default' handler", async () => {
    await testProcessLauncher((trigger) => {
      return [
        {
          default: trigger,
        },
      ];
      /* * /
          {
        Selection(context: Record<string, unknown>) {
          console.log("Enter Selection");
          return () => {
            console.log("Exit Selection");
          };
        },
        Wait(context: Record<string, unknown>) {
          console.log("Enter Wait");
          return () => {
            console.log("Exit Wait");
          };
        },
        Selected(context: Record<string, unknown>) {
          console.log("Enter Selected");
          return () => {
            console.log("Exit Selected");
          };
        },
        UpdateSelection(context: Record<string, unknown>) {
          console.log("Enter UpdateSelection");
          return () => {
            console.log("Exit UpdateSelection");
          };
          // app.name);
        },
      },
      // */
    });
  });

  it("should bind event dispatcher to the main process state", async () => {
    await testProcessLauncher((trigger) => {
      return [
        {
          Selection: trigger,
        },
      ];
    });
  });

  it("should bind add loggers to individual states by their name", async () => {
    const traces = [] as string[];
    await testProcessLauncher((trigger) => {
      return [
        {
          default: trigger,
          Wait: newLogger((...message: unknown[]) => {
            traces.push(message.join(""));
          }),
        },
      ];
    });
    expect(traces).toEqual([
      '[00000]....[00000]<Wait event="start">',
      '[00001]....[00000]</Wait><!-- event="start" -->',
      '[00002]......[00001]<Wait event="select">',
      '[00003]......[00001]</Wait><!-- event="select" -->',
      '[00004]......[00002]<Wait event="select">',
      '[00005]......[00002]</Wait><!-- event="select" -->',
      '[00006]....[00003]<Wait event="ok">',
      '[00007]....[00003]</Wait><!-- event="ok" -->',
      '[00008]......[00004]<Wait event="select">',
      '[00009]......[00004]</Wait><!-- event="select" -->',
    ]);
  });

  it("should be able to to await long-running handlers", async () => {
    await testProcessLauncher((trigger) => {
      return [
        {
          Selection: async () => {
            await delay(10);
            return async () => {
              await delay(10);
            };
          },
          default: trigger,
        },
      ];
    });
  });

  it("should be able to bind multiple handlers with different names to the same state", async () => {
    let stateCounterIn = 0;
    let stateCounterOut = 0;
    let controllerCounterIn = 0;
    let controllerCounterOut = 0;
    let viewCounterIn = 0;
    let viewCounterOut = 0;

    await testProcessLauncher((trigger) => {
      return [
        {
          Wait: () => {
            stateCounterIn++;
            return () => {
              stateCounterOut++;
            };
          },
          WaitController: () => {
            controllerCounterIn++;
            return () => {
              controllerCounterOut++;
            };
          },
          WaitView: () => {
            viewCounterIn++;
            return () => {
              viewCounterOut++;
            };
          },
          default: trigger,
        },
      ];
    });
    expect(stateCounterIn).toBe(stateCounterOut);

    expect(controllerCounterIn).toBe(controllerCounterOut);
    expect(controllerCounterIn).toBe(stateCounterIn);

    expect(viewCounterIn).toBe(viewCounterOut);
    expect(viewCounterIn).toBe(stateCounterIn);
  });

  it("should be able to bind multiple handlers to the same state", async () => {
    let aCounterIn = 0;
    let aCounterOut = 0;
    let bCounterIn = 0;
    let bCounterOut = 0;
    let cCounterIn = 0;
    let cCounterOut = 0;

    await testProcessLauncher((trigger) => {
      return [
        {
          default: trigger,
        },
        {
          Wait: async () => {
            aCounterIn++;
            return () => {
              aCounterOut++;
            };
          },
        },
        {
          Wait: () => {
            bCounterIn++;
            return () => {
              bCounterOut++;
            };
          },
        },
        {
          Wait: () => {
            cCounterIn++;
            return () => {
              cCounterOut++;
            };
          },
        },
      ] as Record<string, StageHandler>[];
    });

    expect(aCounterIn).toBe(aCounterOut);

    expect(bCounterIn).toBe(bCounterOut);
    expect(bCounterIn).toBe(aCounterIn);

    expect(cCounterIn).toBe(cCounterOut);
    expect(cCounterIn).toBe(aCounterIn);
  });
});
