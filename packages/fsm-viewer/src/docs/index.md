---
theme: dashboard
toc: false
---

# Charts Visualization

```ts
// import {
//   renderCss,
//   renderStateCharts,
//   renderStateDescription,
//   prepareStateDescriptions,
//   newProcessCharts,
// } from "../index.js";
// view({
//   renderCss,
//   renderStateCharts,
//   renderStateDescription,
//   prepareStateDescriptions,
//   newProcessCharts,
// });
```

```ts
import { type FsmProcess, renderProcess } from "./renderProcess.js";
```

<style>
  .logs {
    max-height: 15em;
    overflow: auto;
    display: block;
    font-family: monospace;
    unicode-bidi: isolate;
    white-space: pre;
    margin: 1em 0px;
  }
  </style>
<div class="grid grid-cols-2" id="process-one" >
  <div class="charts">
  </div>
  <div>
    <div class="card logs"></div>
    <div class="description"></div>
  </div>
</div>

```ts
{
  const { process, charts } = renderProcess(processConfig, {
    element: document.querySelector("#coffee-machine-process"),
    invalidation,
    direction: "lr",
  });

  // Add a logger
  {
    const logContainer = document.querySelector("#process-one .logs");
    const print = (...args: unknown[]) => {
      const text = args.map(String).join("");
      logContainer.append(text);
      logContainer.scrollTop = logContainer.scrollHeight;
    };

    let lineCounter = 1;
    let stack: string[] = [];
    const log = (...args: unknown) =>
      print(lineCounter++, " ", stack.join(""), ...args, "\n");
    process.onStateCreate((state) => {
      state.onEnter(() => {
        log(`<${state.key} event="${state.process.event}">`);
        stack.push("  ");
      });
      state.onExit(() => {
        stack.pop();
        log(`</${state.key}>`);
      });
    });
  }
  const chartsContainer = document.querySelector("#process-one .charts");
  chartsContainer.appendChild(charts);

  // const descriptionContainer = document.querySelector("#process-one .description");
  // descriptionContainer.appendChild(description);

  process.dispatch("start");
}
```

```ts
const processConfig1 = {
  key: "App",
  transitions: [
    ["", "*", "OpenFileSystem"],
    ["OpenFileSystem", "error", "ShowError"],
    ["OpenFileSystem", "ok", "OpenFileSystem"],
    ["OpenFileSystem", "exit", ""],
    ["ShowError", "ok", "OpenFileSystem"],
  ],
  states: [
    {
      key: "OpenFileSystem",
      transitions: [
        ["", "*", "ChooseFolder"],
        ["ChooseFolder", "ok", "CheckFolderAccess"],
        ["CheckFolderAccess", "ok", ""],
        ["CheckFolderAccess", "error", ""],
      ],
      states: [
        {
          key: "ChooseFolder",
          transitions: [
            ["", "*", "A"],
            ["A", "ok", "B"],
            ["A", "check", "C"],
            ["C", "ok", "B"],
            ["B", "cancel", "A"],
          ],
        },
      ],
    },
    {
      key: "ShowError",
      transitions: [
        ["", "*", "ShowMessage"],
        ["ShowMessage", "details", "ShowDetailedMessage"],
        ["ShowDetailedMessage", "back", "ShowMessage"],
      ],
    },
  ],
};
```

```ts
const processConfig = {
  key: "CoffeeMachine",
  label: "My Coffee Machine",
  transitions: [
    ["", "*", "WaitForSelection"],
    ["WaitForSelection", "select", "CheckAvailability"],
    ["CheckAvailability", "ok", "PrepareDrink"],
    ["CheckAvailability", "error", "ShowError"],
    ["PrepareDrink", "done", "DispenseDrink"],
    ["DispenseDrink", "taken", "WaitForSelection"],
    ["ShowError", "acknowledge", "WaitForSelection"],
    ["*", "switch", ""],
  ],
  states: [
    {
      key: "WaitForSelection",
      label: "Wait for selection",
      description:
        "State where the machine display various options and is waiting for a user to select a drink.",
      transitions: [
        ["", "*", "DisplayWelcomeScreen"],
        ["DisplayWelcomeScreen", "touch", "DisplayOptions"],
        ["DisplayOptions", "select", ""],
        ["DisplayOptions", "timeout", "DisplayWelcomeScreen"],
      ],
    },
    {
      key: "CheckAvailability",
      label: "Check availability",
      description:
        "State where the machine checks the availability of the selected drink. It can rise two events 'ok' or 'error' if the drink is not available.",
    },
    {
      key: "PrepareDrink",
      label: "Prepare Drink",
      description: "State where the machine is preparing the selected drink.",
      transitions: [
        ["", "*", "HeatWater"],
        ["HeatWater", "done", "BrewCoffee"],
        ["BrewCoffee", "done", ""],
      ],
    },
    {
      key: "DispenseDrink",
      label: "Dispence Drink",
      description: "State where the machine is dispensing the prepared drink.",
      transitions: [
        ["", "*", "WaitForPickup"],
        ["WaitForPickup", "taken", ""],
      ],
    },
    {
      key: "ShowError",
      label: "Show Error",
      description: "State where the machine is showing an error message.",
      transitions: [
        ["", "*", "DisplayErrorMessage"],
        ["DisplayErrorMessage", "acknowledge", ""],
      ],
    },
  ],
};
```

<template id="coffee-machine-process">

# [CoffeeMachine] Coffee Machine

This state machine describes behaviour of a Cofee Machine.

## [Off] Off State

In this state the coffee machine is off. Nothing will happen until it is switched on.

### [On] On State

In this state the coffee machine is working.

### [DisplayWelcomeScreen] Welcome Screen

Big Welcome message!

### [DisplayOptions]

Shows menu with different drinks:

- Tea
- Milk
- Coffee

### [WaitForSelection] Wait For Selection

Wait for user's selection of a coffee.
The initial sub-state.

### [CheckAvailability] Check Availability

At this state the machine checks if there is a selected type of coffee.

### [PrepareDrink] Prepare Drink

Preparing the selected drink.

### [DispenseDrink]

The prepared drink is pooring in the cup.

### [ShowError]

Something goes wrong. Asknowledge the client about the error and allow to return back to the drink selection menu.

### [DisplayErrorMessage] Error Message Details

Show detailed description of the occurred error.

</template>
