import type { FsmStateConfig } from "../src/types.ts";

/** Valid: Simple light bulb toggle with burnout exit */
export const lightBulb: FsmStateConfig = {
  key: "LightBulb",
  description: "A simple on/off light bulb",
  transitions: [
    ["", "*", "Off"],
    ["Off", "toggle", "On"],
    ["On", "toggle", "Off"],
    ["*", "burnOut", ""],
  ],
  states: [
    {
      key: "Off",
      description: "Light is off",
      events: {
        toggle: "When user presses the light switch",
        burnOut: "When the bulb burns out",
      },
    },
    {
      key: "On",
      description: "Light is on",
      events: {
        toggle: "When user presses the light switch",
        burnOut: "When the bulb burns out",
      },
    },
  ],
};

/** Valid: Nested ticket flow with exit propagation */
export const ticketFlow: FsmStateConfig = {
  key: "TicketFlow",
  name: "Support Ticket Flow",
  description: "Support ticket lifecycle",
  outcome: "Ticket is resolved and closed",
  actors: ["Support Agent", "L2 Team"],
  object: "Support Ticket",
  transitions: [
    ["", "*", "Handle"],
    ["Handle", "resolved", "Closed"],
    ["Closed", "done", ""],
  ],
  states: [
    {
      key: "Handle",
      description: "Handle the support ticket",
      outcome: "Issue is diagnosed and resolved",
      events: { resolved: "When the issue has been fully resolved" },
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
          outcome: "Root cause is identified",
          events: {
            resolved: "When the issue is identified and fixed",
            notResolved: "When the issue cannot be resolved at current level",
          },
        },
        {
          key: "Escalate",
          description: "Escalate to L2",
          outcome: "Issue is resolved by L2 team",
          events: {
            resolved: "When L2 team resolves the issue",
          },
        },
      ],
    },
    {
      key: "Closed",
      description: "Ticket is closed",
      events: { done: "When closing procedures are complete" },
    },
  ],
};

/** Valid: Coffee machine with wildcards and complex nesting */
export const coffeeMachine: FsmStateConfig = {
  key: "CoffeeMachine",
  description: "Automated coffee machine controller",
  transitions: [
    ["", "*", "Idle"],
    ["Idle", "userApproach", "WelcomeScreen"],
    ["WelcomeScreen", "selectDrink", "PreparingDrink"],
    ["WelcomeScreen", "timeout", "Idle"],
    ["PreparingDrink", "brewingComplete", "Idle"],
    ["*", "maintenanceMode", "Maintenance"],
    ["Maintenance", "maintenanceComplete", "Idle"],
  ],
  states: [
    {
      key: "Idle",
      description: "Machine is idle, waiting for user",
      events: {
        userApproach: "When proximity sensor detects a user",
        maintenanceMode: "When maintenance schedule triggers",
      },
    },
    {
      key: "WelcomeScreen",
      description: "Displaying drink selection menu",
      events: {
        selectDrink: "When user selects a drink from the menu",
        timeout: "When no input is received within 30 seconds",
        maintenanceMode: "When maintenance schedule triggers",
      },
    },
    {
      key: "PreparingDrink",
      description: "Preparing the selected drink",
      outcome: "Drink is ready for pickup",
      events: {
        brewingComplete: "When all preparation steps are complete",
        maintenanceMode: "When maintenance schedule triggers",
      },
      transitions: [
        ["", "*", "GrindBeans"],
        ["GrindBeans", "beansGround", "HeatWater"],
        ["HeatWater", "waterHeated", "Brew"],
        ["Brew", "brewingComplete", ""],
      ],
      states: [
        {
          key: "GrindBeans",
          description: "Grinding coffee beans",
          events: { beansGround: "When beans are fully ground" },
        },
        {
          key: "HeatWater",
          description: "Heating water to optimal temperature",
          events: { waterHeated: "When water reaches 93°C" },
        },
        {
          key: "Brew",
          description: "Brewing the coffee",
          events: {
            brewingComplete: "When extraction is complete",
          },
        },
      ],
    },
    {
      key: "Maintenance",
      description: "Machine under maintenance",
      events: {
        maintenanceComplete: "When maintenance procedures are finished",
      },
    },
  ],
};

/** Valid: Document review with cycle (has exit) */
export const documentReview: FsmStateConfig = {
  key: "DocumentReview",
  description: "Document review and approval process",
  outcome: "Document is approved or rejected",
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
    {
      key: "UnderReview",
      description: "Document is being reviewed",
      events: {
        approved: "When all reviewers approve the document",
        requiresRevision: "When reviewer requests changes",
      },
    },
    {
      key: "RequiresRevision",
      description: "Document needs revision by author",
      events: {
        revised: "When author submits updated version",
        maxRevisionsExceeded: "When revision count exceeds the allowed limit",
      },
    },
    {
      key: "Approved",
      description: "Document has been approved",
      outcome: "Ready for publication",
      events: { published: "When document is published to production" },
    },
    {
      key: "Rejected",
      description: "Document has been rejected",
      outcome: "Document is archived and closed",
      events: { archived: "When document is moved to archive" },
    },
  ],
};
