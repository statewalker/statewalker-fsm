import { FsmProcess } from "../src/index.ts";
import { describe, expect, it } from "./deps.ts";
import config from "./process.CofeeMachine.ts";

describe("FsmAsyncProcess: step-by-step debugging", () => {
  const options = {
    config,
    events: [
      // Start application
      "",
      // The user toches the screen
      "touch",
      // Timeout - nothing was selected during this period
      "timeout",
      // Select a drink
      "touch",
      "select",

      // Validate that the drink is available
      "ok",
      // Heat water: ok
      "done",
      // Prepare the drink: ok
      "done",

      // Wait for pickup: ok
      "taken",

      // Switch off
      "switch",
    ],
    control: [
      "-[]->CoffeeMachine/WaitForSelection/DisplayWelcomeScreen",
      "-[touch]->CoffeeMachine/WaitForSelection/DisplayOptions",
      "-[timeout]->CoffeeMachine/WaitForSelection/DisplayWelcomeScreen",
      "-[touch]->CoffeeMachine/WaitForSelection/DisplayOptions",
      "-[select]->CoffeeMachine/CheckAvailability",
      "-[ok]->CoffeeMachine/PrepareDrink/HeatWater",
      "-[done]->CoffeeMachine/PrepareDrink/BrewCoffee",
      "-[done]->CoffeeMachine/DispenseDrink/WaitForPickup",
      "-[taken]->CoffeeMachine/WaitForSelection/DisplayWelcomeScreen",
      "-[switch]->",
    ],
    traces: [
      '  <CoffeeMachine event="">',
      '    <WaitForSelection event="">',
      '      <DisplayWelcomeScreen event="">',
      "       [DisplayWelcomeScreen:]",
      "      </DisplayWelcomeScreen>",
      '      <DisplayOptions event="touch">',
      "       [DisplayOptions:touch]",
      "      </DisplayOptions>",
      '      <DisplayWelcomeScreen event="timeout">',
      "       [DisplayWelcomeScreen:timeout]",
      "      </DisplayWelcomeScreen>",
      '      <DisplayOptions event="touch">',
      "       [DisplayOptions:touch]",
      "      </DisplayOptions>",
      "    </WaitForSelection>",
      '    <CheckAvailability event="select">',
      "     [CheckAvailability:select]",
      "    </CheckAvailability>",
      '    <PrepareDrink event="ok">',
      '      <HeatWater event="ok">',
      "       [HeatWater:ok]",
      "      </HeatWater>",
      '      <BrewCoffee event="done">',
      "       [BrewCoffee:done]",
      "      </BrewCoffee>",
      "    </PrepareDrink>",
      '    <DispenseDrink event="done">',
      '      <WaitForPickup event="done">',
      "       [WaitForPickup:done]",
      "      </WaitForPickup>",
      "    </DispenseDrink>",
      '    <WaitForSelection event="taken">',
      '      <DisplayWelcomeScreen event="taken">',
      "       [DisplayWelcomeScreen:taken]",
      "      </DisplayWelcomeScreen>",
      "    </WaitForSelection>",
      "  </CoffeeMachine>",
    ],
  };

  function newProcess(print: (msg: string) => void): FsmProcess {
    const process = new FsmProcess(options.config);
    process.onStateCreate((state) => {
      state.onEnter(() => {
        print(`<${state?.key} event="${state.process.event}">`);
      });
      state.onExit(() => {
        print(`</${state.key}>`);
      });
    });
    return process;
  }

  it("should iterate over states and perform required state transitions", async () => {
    const testTraces: string[] = [];
    const print = (msg: string) => {
      let shift = "";
      for (let state = process.state; state; state = state.parent) {
        shift += "  ";
      }
      testTraces.push(shift + msg);
    };
    const getPath = () => {
      const stack: string[] = [];
      for (let state = process.state; state; state = state.parent) {
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
      if (process.state) {
        print(` [${stateKey}:${eventKey}]`);
      }
    }
    expect(test).toEqual(control);
    expect(testTraces).toEqual(traces);
  });
});
