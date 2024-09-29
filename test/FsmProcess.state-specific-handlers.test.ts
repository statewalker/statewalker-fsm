import { FsmProcess, FsmState, FsmStateConfig } from "../src/index.ts";
import { getPrinter, setProcessPrinter } from "../src/context/printer.ts";
import { setProcessTracer } from "../src/context/tracer.ts";
import { describe, it, expect } from "./deps.ts";
import config from "./process.ProductCatalog.ts";
import {
  addSubstateHandlers,
  callStateHandlers,
} from "../src/context/handlers.ts";

describe("dispatch state handlers", () => {
  function newPrintChecker() {
    const lines: string[][] = [];
    return [
      (...args: string[]) => lines.push(args),
      (...control: string[]) => {
        expect(lines.map((items) => items.join(""))).toEqual(control);
      },
    ];
  }

  // State-specific handlers
  function ProductList(state: FsmState) {
    const log = getPrinter(state);
    state.onEnter(() => log("(ProductList)"));
    state.onExit(() => log("(/ProductList)"));
  }
  function ProductCatalog(state: FsmState) {
    addSubstateHandlers(state, {
      ProductList,
    });
    const log = getPrinter(state);
    state.onEnter(async () => log("{ProductCatalog}"));
    state.onExit(() => log("{/ProductCatalog}"));
  }
  function ProductBasket(state: FsmState) {
    const log = getPrinter(state);
    state.onEnter(() => log("* BASKET:enter"));
    state.onExit(() => log("* BASKET:exit"));
  }

  function newProcess(
    root: FsmStateConfig,
    config: {
      prefix?: string;
      print: (...args: string[]) => void;
      lineNumbers: boolean;
    }
  ): FsmProcess {
    let process: FsmProcess;
    // let printLine: (...args: string[]) => void;
    process = new FsmProcess(root);
    setProcessTracer(process);
    setProcessPrinter(process, {
      prefix: config.prefix,
      lineNumbers: true,
      print: config.print, // console.error,
    });
    process.onStateCreate((state: FsmState) => {
      if (state.key === "App") {
        // Define handlers for sub-states
        addSubstateHandlers(state, {
          ProductCatalog,
          ProductBasket,
        });
      }
      callStateHandlers(state);
    });
    return process;
  }

  it("should track transitions between states", async () => {
    const [print, checkLines] = newPrintChecker();
    const process = newProcess(config, {
      print,
      lineNumbers: true,
    });

    await process.dispatch("start");
    checkLines(
      '[1]<App event="start">',
      '[2]  <ProductCatalog event="start">',
      "[3]  {ProductCatalog}",
      '[4]    <ProductList event="start">',
      "[5]    (ProductList)"
    );

    await process.dispatch("showBasket");
    checkLines(
      '[1]<App event="start">',
      '[2]  <ProductCatalog event="start">',
      "[3]  {ProductCatalog}",
      '[4]    <ProductList event="start">',
      "[5]    (ProductList)",
      "[6]    (/ProductList)",
      '[7]    </ProductList> <!-- event="showBasket" -->',
      "[8]  {/ProductCatalog}",
      '[9]  </ProductCatalog> <!-- event="showBasket" -->',
      '[10]  <ProductBasket event="showBasket">',
      "[11]  * BASKET:enter",
      '[12]    <ShowSelectedProducts event="showBasket">'
    );

    await process.dispatch("back");
    checkLines(
      '[1]<App event="start">',
      '[2]  <ProductCatalog event="start">',
      "[3]  {ProductCatalog}",
      '[4]    <ProductList event="start">',
      "[5]    (ProductList)",
      "[6]    (/ProductList)",
      '[7]    </ProductList> <!-- event="showBasket" -->',
      "[8]  {/ProductCatalog}",
      '[9]  </ProductCatalog> <!-- event="showBasket" -->',
      '[10]  <ProductBasket event="showBasket">',
      "[11]  * BASKET:enter",
      '[12]    <ShowSelectedProducts event="showBasket">',
      '[13]    </ShowSelectedProducts> <!-- event="back" -->',
      "[14]  * BASKET:exit",
      '[15]  </ProductBasket> <!-- event="back" -->',
      '[16]  <ProductCatalog event="back">',
      "[17]  {ProductCatalog}",
      '[18]    <ProductList event="back">',
      "[19]    (ProductList)"
    );

    await process.dispatch("exit");
    checkLines(
      '[1]<App event="start">',
      '[2]  <ProductCatalog event="start">',
      "[3]  {ProductCatalog}",
      '[4]    <ProductList event="start">',
      "[5]    (ProductList)",
      "[6]    (/ProductList)",
      '[7]    </ProductList> <!-- event="showBasket" -->',
      "[8]  {/ProductCatalog}",
      '[9]  </ProductCatalog> <!-- event="showBasket" -->',
      '[10]  <ProductBasket event="showBasket">',
      "[11]  * BASKET:enter",
      '[12]    <ShowSelectedProducts event="showBasket">',
      '[13]    </ShowSelectedProducts> <!-- event="back" -->',
      "[14]  * BASKET:exit",
      '[15]  </ProductBasket> <!-- event="back" -->',
      '[16]  <ProductCatalog event="back">',
      "[17]  {ProductCatalog}",
      '[18]    <ProductList event="back">',
      "[19]    (ProductList)",
      "[20]    (/ProductList)",
      '[21]    </ProductList> <!-- event="exit" -->',
      "[22]  {/ProductCatalog}",
      '[23]  </ProductCatalog> <!-- event="exit" -->',
      '[24]</App> <!-- event="exit" -->'
    );
  });

  it("should be able to add a prefix to all lines", async () => {
    const [print, checkLines] = newPrintChecker();
    const process = newProcess(config, {
      prefix: "abc",
      print,
      lineNumbers: true,
    });

    await process.dispatch("start");
    checkLines(
      'abc[1]<App event="start">',
      'abc[2]  <ProductCatalog event="start">',
      "abc[3]  {ProductCatalog}",
      'abc[4]    <ProductList event="start">',
      "abc[5]    (ProductList)"
    );

    await process.dispatch("showBasket");
    checkLines(
      'abc[1]<App event="start">',
      'abc[2]  <ProductCatalog event="start">',
      "abc[3]  {ProductCatalog}",
      'abc[4]    <ProductList event="start">',
      "abc[5]    (ProductList)",
      "abc[6]    (/ProductList)",
      'abc[7]    </ProductList> <!-- event="showBasket" -->',
      "abc[8]  {/ProductCatalog}",
      'abc[9]  </ProductCatalog> <!-- event="showBasket" -->',
      'abc[10]  <ProductBasket event="showBasket">',
      "abc[11]  * BASKET:enter",
      'abc[12]    <ShowSelectedProducts event="showBasket">'
    );

    await process.dispatch("back");
    checkLines(
      'abc[1]<App event="start">',
      'abc[2]  <ProductCatalog event="start">',
      "abc[3]  {ProductCatalog}",
      'abc[4]    <ProductList event="start">',
      "abc[5]    (ProductList)",
      "abc[6]    (/ProductList)",
      'abc[7]    </ProductList> <!-- event="showBasket" -->',
      "abc[8]  {/ProductCatalog}",
      'abc[9]  </ProductCatalog> <!-- event="showBasket" -->',
      'abc[10]  <ProductBasket event="showBasket">',
      "abc[11]  * BASKET:enter",
      'abc[12]    <ShowSelectedProducts event="showBasket">',
      'abc[13]    </ShowSelectedProducts> <!-- event="back" -->',
      "abc[14]  * BASKET:exit",
      'abc[15]  </ProductBasket> <!-- event="back" -->',
      'abc[16]  <ProductCatalog event="back">',
      "abc[17]  {ProductCatalog}",
      'abc[18]    <ProductList event="back">',
      "abc[19]    (ProductList)"
    );
  });
});
