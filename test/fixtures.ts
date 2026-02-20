import type { FsmStateConfig } from "../src/types.ts";

/** Valid: Simple light bulb toggle */
export const lightBulb: FsmStateConfig = {
  key: "LightBulb",
  transitions: [
    ["", "*", "Off"],
    ["Off", "toggle", "On"],
    ["On", "toggle", "Off"],
  ],
  states: [
    { key: "Off", description: "Light is off", events: ["toggle"] },
    { key: "On", description: "Light is on", events: ["toggle"] },
  ],
};

/** Valid: Nested ticket flow with exit propagation */
export const ticketFlow: FsmStateConfig = {
  key: "TicketFlow",
  transitions: [
    ["", "*", "Handle"],
    ["Handle", "resolved", "Closed"],
    ["Closed", "done", ""],
  ],
  states: [
    {
      key: "Handle",
      description: "Handle the support ticket",
      events: ["resolved"],
      transitions: [
        ["", "*", "Diagnose"],
        ["Diagnose", "notResolved", "Escalate"],
        ["Diagnose", "resolved", ""],
        ["Escalate", "resolved", ""],
      ],
      states: [
        {
          key: "Diagnose",
          description: "Identify the issue",
          events: ["resolved", "notResolved"],
        },
        {
          key: "Escalate",
          description: "Escalate to L2",
          events: ["resolved"],
        },
      ],
    },
    { key: "Closed", description: "Ticket is closed", events: ["done"] },
  ],
};

/** Valid: Coffee machine with wildcards and complex nesting */
export const coffeeMachine: FsmStateConfig = {
  key: "CoffeeMachine",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "userApproach", "WelcomeScreen"],
    ["WelcomeScreen", "selectDrink", "PreparingDrink"],
    ["WelcomeScreen", "timeout", "Idle"],
    ["PreparingDrink", "drinkReady", "Idle"],
    ["*", "maintenanceMode", "Maintenance"],
    ["Maintenance", "maintenanceComplete", "Idle"],
  ],
  states: [
    { key: "Idle", events: ["userApproach", "maintenanceMode"] },
    {
      key: "WelcomeScreen",
      events: ["selectDrink", "timeout", "maintenanceMode"],
    },
    {
      key: "PreparingDrink",
      events: ["drinkReady", "maintenanceMode"],
      transitions: [
        ["", "*", "GrindBeans"],
        ["GrindBeans", "beansGround", "HeatWater"],
        ["HeatWater", "waterHeated", "Brew"],
        ["Brew", "brewingComplete", ""],
      ],
      states: [
        { key: "GrindBeans", events: ["beansGround"] },
        { key: "HeatWater", events: ["waterHeated"] },
        { key: "Brew", events: ["brewingComplete"] },
      ],
    },
    { key: "Maintenance", events: ["maintenanceComplete"] },
  ],
};

/** Valid: Document review with cycle (has exit) */
export const documentReview: FsmStateConfig = {
  key: "DocumentReview",
  transitions: [
    ["", "*", "UnderReview"],
    ["UnderReview", "approved", "Approved"],
    ["UnderReview", "requiresRevision", "RequiresRevision"],
    ["RequiresRevision", "revised", "UnderReview"],
    ["RequiresRevision", "maxRevisionsExceeded", "Rejected"],
    ["Approved", "published", ""],
    ["Rejected", "archived", ""],
  ],
  states: [
    { key: "UnderReview", events: ["approved", "requiresRevision"] },
    { key: "RequiresRevision", events: ["revised", "maxRevisionsExceeded"] },
    { key: "Approved", events: ["published"] },
    { key: "Rejected", events: ["archived"] },
  ],
};
