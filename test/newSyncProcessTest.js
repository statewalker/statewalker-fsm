import expect from "expect.js";
import newSyncProcess from "../src/newSyncProcess.js";

describe("newSyncProcess", () => {
  const config = {
    key: "Root",
    transitions: [
      ["*", "$done", ""],
      ["*", "*", "_DocDispatch"],
      ["*", "html", "HtmlDocument"],
      ["*", "head", "HtmlDocument"],
      ["*", "body", "HtmlDocument"],
    ],
    states: [
      {
        key: "HtmlDocument",
        transitions: [
          ["*", "$done", ""],
          ["", "head", "HtmlHead"],
          ["", "body", "HtmlBody"],

          ["HtmlHead", "$done", ""],
          ["HtmlHead", "*", "HtmlBody"],
        ],
        states: [
          {
            key: "HtmlHead",
            transitions: [
              ["", "*", "_Ignore"],

              ["*", "$done", ""],
              ["*", "space", "_Ignore"],
              ["*", "link", "HtmlLink"],
              ["*", "script", "HtmlScript"],
              ["*", "meta", "HtmlMeta"],
              ["*", "style", "HtmlStyle"],
              ["*", "text", "_HtmlHeadDispatch"],
            ],
          },
          {
            key: "HtmlBody",
            transitions: [
              ["*", "$done", ""],
              ["*", "space", "_Ignore"],
              ["", "*", "_BlockContainer"]
            ],
          },
          {
            key: "_BlockContainer",
            transitions: [
              ["*", "$done", ""],

              ["*", "*", "HtmlParagraph"],
              ["*", "p", "HtmlParagraph"],
              ["*", "blockquot", "HtmlBlockquot"],

              ["*", "hr", "HtmlHr"],

              ["*", "table", "HtmlTable"],

              ["*", "tbody", ""],
              ["*", "thead", ""],
              ["*", "tr", ""],
              ["*", "th", ""],
              ["*", "td", ""],

              // ["*", "tbody", "HtmlTable"],
              // ["*", "thead", "HtmlTable"],
              // ["*", "tr", "HtmlTable"],
              // ["*", "th", "HtmlTable"],
              // ["*", "td", "HtmlTable"],

              ["*", "ul", "HtmlUl"],
              ["*", "li", "HtmlUl"],
              ["*", "ol", "HtmlOl"],

              ["*", "dl", "HtmlDl"],
              ["*", "dt", "HtmlDl"],
              ["*", "dd", "HtmlDl"],
            ],
            states: [
              {
                key: "HtmlParagraph",
                transitions: [
                  ["*", "$done", ""],
                  ["", "*", "_InlineContainer"],
                ],
              },
              {
                key: "HtmlTable",
                transitions: [
                  ["*", "$done", ""],
                  ["", "table", "_Init"],
                  ["_Init", "*", "HtmlTableBody"],
                  

                  ["*", "thead:close", "_AfterHtmlTableHeader"],
                  ["*", "tbody:close", "_AfterHtmlTableBody"],
                  ["*", "table:close", "_AfterHtmlTableBody"],
                  ["_AfterHtmlTableBody", "*", ""],

                  ["*", "*", "_Ignore"],

                  ["*", "thead", "HtmlTableHeader"],
                  ["*", "tbody", "HtmlTableBody"],
                  ["", "*", "HtmlTableBody"],
                  ["HtmlTableHeader", "tbody", "HtmlTableBody"],
                ],
                states : [
                  {
                    key: "HtmlTableBody",
                    transitions: [
                      ["*", "$done", ""],
                      ["", "tbody", "_Init"],
                      ["", "*", "_HtmlTableRows"],
                      ["_Init", "*", "_HtmlTableRows"],
                    ],
                  },
                  {
                    key: "HtmlTableHeader",
                    transitions: [
                      ["*", "$done", ""],
                      ["", "thead", "_Init"],
                      ["", "*", "_HtmlTableRows"],
                      ["_Init", "*", "_HtmlTableRows"],
                    ],
                  },
                  {
                    key: "_HtmlTableRows",
                    transitions: [
                      ["*", "$done", ""],
                      ["", "*", "HtmlTableRow"],
                      ["*", "tr", "HtmlTableRow"],
                      ["*", "th", "HtmlTableRow"],
                      ["*", "td", "HtmlTableRow"],
                      ["*", "tr:close", "_AfterHtmlTableRow"],
                      ["*", "thead:close", ""],
                      ["*", "tbody:close", ""],
                      ["*", "table:close", ""],
                    ],
                  },
                  {
                    key: "HtmlTableRow",
                    transitions: [
                      ["*", "$done", ""],
                      ["", "*", "HtmlTableCell"],
                      ["", "tr", "_Init"],
                      ["_Init", "*", "HtmlTableCell"],
                      ["*", "th", "HtmlTableCell"],
                      ["*", "td", "HtmlTableCell"],

                      ["*", "th:close", "_AfterHtmlTableCell"],
                      ["*", "td:close", "_AfterHtmlTableCell"],
                    ],
                    states : [
                      {
                        key: "HtmlTableCell",
                        transitions: [
                          ["*", "$done", ""],
                          ["", "th", "_Init"],
                          ["", "td", "_Init"],
                          // ["_Init", "*", "_Ignore"],

                          ["_Init", "*", "_BlockContainer"],
                          ["", "*", "_BlockContainer"],
                          // ["_Init", "*", "_InlineContainer"],
                          // ["", "*", "_InlineContainer"],


                          // ["", "table", "_Ignore"],
                          // ["", "tbody", "_Ignore"],
                          // ["", "thead", "_Ignore"],
                          // ["", "tr", "_Ignore"],
                          // ["", "th", "_Ignore"],
                          // ["", "td", "_Ignore"],

                          // ["*", "table:close", ""],
                          // ["*", "tbody:close", ""],
                          // ["*", "thead:close", ""],
                          // ["*", "tr:close", ""],
                          // ["*", "th:close", ""],
                          // ["*", "td:close", ""],

                        ],
                      }
                    ]
                  }
                ]
              },
              {
                key: "_InlineContainer",
                transitions: [
                  ["*", "$done", ""],
                  ["", "*", "InlineElement"],

                  ["*", "em", "InlineElement"],
                  ["*", "i", "InlineElement"],
                  ["*", "strong", "InlineElement"],
                  ["*", "b", "InlineElement"],
                ],
                states : [
                  {
                    key: "InlineElement",
                    transitions: [
                      ["*", "$done", ""],
                      ["", "*", "_Ignore"],    
                      ["*", "text", "Text"],
                    ],
                  },
                ]
              },
            ]
          },
        ],
      },
    ],
  };

  function newProcess({ config, print }) {
    let process;
    const before = (process) => {
      const state = process.current;
      const { key, ...options } = process.event;
      process.print(`<${state.key} event="${key}">`, options);
    };
    const after = (process) => {
      const state = process.current;
      process.print(`</${state.key}>`);
    };
    process = newSyncProcess({
      config,
      before,
      after,
    });
    process.print = (msg, ...args) => {
      if (process.current && (process.current.key[0] === '_')) return;
      let shift = "";
      for (let i = 0; i <= process.stack.length; i++) {
        if (process.stack[i] && (process.stack[i].key[0] === '_')) continue;
        shift += "  ";
      }
      print(shift + msg, ...args);
    };

    process.getPath = () => {
      const stack = [...process.stack, process.current];
      return stack.map((s) => s.key).join("/");
    };
    process.getEventKey = () => (process.event && process.event.key) || "";
    process.getStateKey = () => (process.current && process.current.key) || "";

    return process;
  }

  it(`should iterate over states and perform required state transitions`, async () => {
    const testTraces = [];
    const process = newProcess({
      config,
      print: console.log, // (...args) => testTraces.push(args),
    });
    const next = (token) => {
      process.dispatch({ key: token.type, token });
    };
    next({ type: "enter" });
    next({ type: "head", toto: "Titi" });
    next({ type: "link"  });
    next({ type: "script"  });
    next({ type: "style"  });

    next({ type: "p"  });
    next({ type: "text"  });

    next({ type: "table"  });
    next({ type: "thead"  });

    next({ type: "td"  });
    next({ type: "text"  });

    next({ type: "tbody"  });
    next({ type: "td"  });
    next({ type: "text"  });

    next({ type: "tr"  });
    next({ type: "text"  });

    next({ type: "tbody:close"  });
    next({ type: "text"  });

    next({ type: "table:close"  });

console.log('------------------------')
    next({ type: "table"  });
    next({ type: "text"  });
    next({ type: "text"  });
    next({ type: "text"  });
    next({ type: "em"  });

    next({ type: "tr"  });
    next({ type: "strong"  });
    next({ type: "text"  });

    // next({ type: "$done"  });
    // console.log(testTraces);
  });
});
