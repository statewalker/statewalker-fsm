import type { FsmStateConfig } from "../src/FsmStateConfig.ts";

export default {
  "key": "CoffeeMachine",
  "transitions": [
    ["", "*", "WaitForSelection"],
    ["WaitForSelection", "select", "CheckAvailability"],
    ["CheckAvailability", "ok", "PrepareDrink"],
    ["CheckAvailability", "error", "ShowError"],
    ["PrepareDrink", "done", "DispenseDrink"],
    ["DispenseDrink", "taken", "WaitForSelection"],
    ["ShowError", "acknowledge", "WaitForSelection"],
    ["*", "switch", ""]
  ],
  "states": [
    {
      "key": "WaitForSelection",
      "description": "State where the machine display various options and is waiting for a user to select a drink.",
      "transitions": [
        ["", "*", "DisplayWelcomeScreen"],
        ["DisplayWelcomeScreen", "touch", "DisplayOptions"],
        ["DisplayOptions", "select", ""],
        ["DisplayOptions", "timeout", "DisplayWelcomeScreen"]
      ]
    },
    {
      "key": "CheckAvailability",
      "description": "State where the machine checks the availability of the selected drink. It can rise two events 'ok' or 'error' if the drink is not available.",
    },
    {
      "key": "PrepareDrink",
      "description": "State where the machine is preparing the selected drink.",
      "transitions": [
        ["", "*", "HeatWater"],
        ["HeatWater", "done", "BrewCoffee"],
        ["BrewCoffee", "done", ""],
      ]
    },
    {
      "key": "DispenseDrink",
      "description": "State where the machine is dispensing the prepared drink.",
      "transitions": [
        ["", "*", "WaitForPickup"],
        ["WaitForPickup", "taken", ""]
      ]
    },
    {
      "key": "ShowError",
      "description": "State where the machine is showing an error message.",
      "transitions": [
        ["", "*", "DisplayErrorMessage"],
        ["DisplayErrorMessage", "acknowledge", ""]
      ]
    }
  ]
} as FsmStateConfig;