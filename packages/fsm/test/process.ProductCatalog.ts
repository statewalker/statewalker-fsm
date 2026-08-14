import type { FsmStateConfig } from "../src/core/fsm-state-config.ts";

export default {
  key: "App",
  transitions: [
    ["", "*", "ProductCatalog"],
    ["ProductCatalog", "showBasket", "ProductBasket"],
    ["ProductCatalog", "removeFromBasket", "ProductBasket"],
    ["ProductCatalog", "addToBasket", "ProductBasket"],
    ["ProductBasket", "back", "ProductCatalog"],
  ],
  states: [
    {
      key: "ProductCatalog",
      transitions: [
        ["", "*", "ProductList"],
        ["ProductList", "showDetails", "ProductView"],
        ["ProductView", "back", "ProductList"],
      ],
    },
    {
      key: "ProductBasket",
      transitions: [
        ["", "*", "ShowSelectedProducts"],
        ["", "addToBasket", "HandleBasketUpdate"],
        ["", "removeFromBasket", "HandleBasketUpdate"],

        ["ShowSelectedProducts", "showDetails", "ProductView"],

        ["ProductView", "back", "ShowSelectedProducts"],
        ["ProductView", "addToBasket", "HandleBasketUpdate"],
        ["ProductView", "removeFromBasket", "HandleBasketUpdate"],

        ["HandleBasketUpdate", "ok", "ShowSelectedProducts"],
      ],
    },
  ],
} as FsmStateConfig;
