import { FsmProcessHandler, FsmStateConfig } from "../dist/index.js";
import { FsmProcess } from "../src/FsmProcess.js";
import { describe, it, expect } from "./deps.js";
import { newProcessLogger } from "./newProcessLogger.js";
import config from "./productCatalogStatechart.js";

describe("newProcessLogger", () => {
  function newPrintChecker() {
    const lines: string[][] = [];
    return [
      (...args: string[]) => lines.push(args),
      (...control: string[]) =>
        expect(lines.map((items) => items.join(""))).toEqual(control),
    ];
  }

  function newProcess(
    root: FsmStateConfig,
    config: {
      prefix?: string;
      print: (...args: string[]) => void;
      lineNumbers: boolean;
    }
  ): FsmProcess {
    let printLine: (...args: string[]) => void;
    const process = new FsmProcess({
      root,
      onStateCreate: (state) => {
        state.onEnter(() => {
          printLine(`<${state?.key} event="${state.process.event}">`);
        });
        state.onExit(() => {
          printLine(`</${state.key}> <!-- event="${process.event}" -->`);
        });
      },
    });
    printLine = newProcessLogger(process, config);
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
      '[3]    <ProductList event="start">'
    );

    await process.dispatch("showBasket");
    checkLines(
      '[1]<App event="start">',
      '[2]  <ProductCatalog event="start">',
      '[3]    <ProductList event="start">',
      '[4]    </ProductList> <!-- event="showBasket" -->',
      '[5]  </ProductCatalog> <!-- event="showBasket" -->',
      '[6]  <ProductBasket event="showBasket">',
      '[7]    <ShowSelectedProducts event="showBasket">'
    );

    await process.dispatch("back");
    checkLines(
      '[1]<App event="start">',
      '[2]  <ProductCatalog event="start">',
      '[3]    <ProductList event="start">',
      '[4]    </ProductList> <!-- event="showBasket" -->',
      '[5]  </ProductCatalog> <!-- event="showBasket" -->',
      '[6]  <ProductBasket event="showBasket">',
      '[7]    <ShowSelectedProducts event="showBasket">',
      '[8]    </ShowSelectedProducts> <!-- event="back" -->',
      '[9]  </ProductBasket> <!-- event="back" -->',
      '[10]  <ProductCatalog event="back">',
      '[11]    <ProductList event="back">'
    );

    await process.dispatch("exit");
    checkLines(
      '[1]<App event="start">',
      '[2]  <ProductCatalog event="start">',
      '[3]    <ProductList event="start">',
      '[4]    </ProductList> <!-- event="showBasket" -->',
      '[5]  </ProductCatalog> <!-- event="showBasket" -->',
      '[6]  <ProductBasket event="showBasket">',
      '[7]    <ShowSelectedProducts event="showBasket">',
      '[8]    </ShowSelectedProducts> <!-- event="back" -->',
      '[9]  </ProductBasket> <!-- event="back" -->',
      '[10]  <ProductCatalog event="back">',
      '[11]    <ProductList event="back">',
      '[12]    </ProductList> <!-- event="exit" -->',
      '[13]  </ProductCatalog> <!-- event="exit" -->',
      '[14]</App> <!-- event="exit" -->'
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
      'abc[3]    <ProductList event="start">'
    );

    await process.dispatch("showBasket");
    checkLines(
      'abc[1]<App event="start">',
      'abc[2]  <ProductCatalog event="start">',
      'abc[3]    <ProductList event="start">',
      'abc[4]    </ProductList> <!-- event="showBasket" -->',
      'abc[5]  </ProductCatalog> <!-- event="showBasket" -->',
      'abc[6]  <ProductBasket event="showBasket">',
      'abc[7]    <ShowSelectedProducts event="showBasket">'
    );

    await process.dispatch("back");
    checkLines(
      'abc[1]<App event="start">',
      'abc[2]  <ProductCatalog event="start">',
      'abc[3]    <ProductList event="start">',
      'abc[4]    </ProductList> <!-- event="showBasket" -->',
      'abc[5]  </ProductCatalog> <!-- event="showBasket" -->',
      'abc[6]  <ProductBasket event="showBasket">',
      'abc[7]    <ShowSelectedProducts event="showBasket">',
      'abc[8]    </ShowSelectedProducts> <!-- event="back" -->',
      'abc[9]  </ProductBasket> <!-- event="back" -->',
      'abc[10]  <ProductCatalog event="back">',
      'abc[11]    <ProductList event="back">'
    );
  });
});