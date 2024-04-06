import { describe, it, expect } from "./deps.js";
import newSyncProcess from "../src/newSyncProcess.js";

function addExitTransitions(state) {
  // return state;
  const result = {
    ...state,
    transitions: [["*", "exit", ""], ...(state.transitions || [])],
  };
  if (state.states && state.states.length) {
    result.states = state.states.map(addExitTransitions);
  }
  return result;
}

function _newState({
  // State key:
  key,

  // The main token opening this state. It is used only if the "tokens" list is not defined:
  token,
  // List of tokens opening this state:
  tokens,

  // Options default content of this state
  content,

  // Sub-states
  states,

  // List of other transitions
  transitions = [],

  // If another token of this type should close the previous one:
  selfClosing = false,

  // List of tokens closing this state.
  // It should contain tokens which can open a new substate,
  // but in this case they are used to close the parent state instead.
  // Example: "li" in another "li" should close the parent item
  // instead of creation of a new sub-list.
  closingTokens = [],
}) {
  const state = {
    key,
    transitions: [],
    states,
  };
  tokens = tokens || (token ? [token] : []);
  for (let token of tokens) {
    state.transitions.push(["", token, `_${key}:before`]);
    state.transitions.push(["*", `${token}:close`, `_${key}:after`]);
  }
  if (selfClosing) {
    closingTokens = [...closingTokens, ...tokens];
  }
  // If it is a self-closing token (ex: "li") then a new token will close this state:
  for (let closingToken of closingTokens) {
    state.transitions.push(["*", closingToken, ""]);
  }

  state.transitions.push(...transitions);
  if (content) {
    state.transitions.push(
      [`_${key}:before`, "*", content],
      ["", "*", content]
    );
  }
  return state;
}

function addInlineTransitions({ transitions = [], ...state }) {
  return {
    ...state,
    transitions: [
      ...transitions,
      ["*", "text", "InlineElement"],
      ["*", "em", "InlineElement"],
      ["*", "i", "InlineElement"],
      ["*", "b", "InlineElement"],
      ["*", "strong", "InlineElement"],
      ["*", "del", "InlineElement"],
      ["*", "span", "InlineElement"],
      ["*", "img", "InlineElement"],
    ],
  };
}

function addBlockTransitions({ transitions = [], ...state } = {}) {
  return {
    ...state,
    transitions: [
      ["*", "*", "HtmlParagraph"],
      ["*", "p", "HtmlParagraph"],
      ["*", "blockquot", "HtmlBlockquot"],

      ["*", "hr", "HtmlHr"],

      ["*", "table", "HtmlTable"],
      ["*", "tbody", "HtmlTable"],
      ["*", "thead", "HtmlTable"],
      ["*", "tfoot", "HtmlTable"],
      ["*", "tr", "HtmlTable"],
      ["*", "th", "HtmlTable"],
      ["*", "td", "HtmlTable"],

      ["*", "ul", "HtmlUl"],
      ["*", "ol", "HtmlOl"],
      ["*", "li", "HtmlUl"],

      ["*", "dl", "HtmlDl"],
      ["*", "dt", "HtmlDl"],
      ["*", "dd", "HtmlDl"],
      ...transitions,
    ],
  };
}

function newHtmlDl() {
  return _newState({
    key: "HtmlDl",
    token: "dl",
    selfClosing: true,
    content: "HtmlDd",
    transitions: [
      ["*", "dt", "HtmlDt"],
      ["*", "dd", "HtmlDd"],
      ["_HtmlDd:before", "*", "HtmlDd"],
    ],
    states: [
      addInlineTransitions(
        _newState({
          key: "HtmlDt",
          token: "dt",
          selfClosing: true,
          closingTokens: ["dd", "dt:close", "dl", "dl:close"],
        })
      ),
      addBlockTransitions(
        addInlineTransitions(
          _newState({
            key: "HtmlDd",
            token: "dd",
            selfClosing: true,
            closingTokens: ["dd", "dd:close", "dl", "dl:close"],
          })
        )
      ),
    ],
  });
}

function newHtmlUl() {
  return _newList("HtmlUl", "ul");
}
function newHtmlOl() {
  return _newList("HtmlOl", "ol");
}

function _newList(key, token) {
  return _newState({
    key,
    token,
    selfClosing: true,
    transitions: [
      ["", "li", "HtmlLi"],
      ["*", "li", "HtmlLi"],
    ],
    states: [
      addBlockTransitions(
        addInlineTransitions(
          _newState({
            key: "HtmlLi",
            token: "li",
            selfClosing: true,
            closingTokens: [token, `${token}:close`],
          })
        )
      ),
    ],
  });
}

function newHtmlTable() {
  return _newState({
    key: "HtmlTable",
    token: "table",
    content: "HtmlTableBody",
    transitions: [
      ["", "thead", "HtmlTableHead"],
      // ["", "tfoot", "HtmlTableFoot"],
      ["_HtmlTable:before", "thead", "HtmlTableHead"],
      ["_HtmlTable:before", "table:close", "HtmlTableBody"],
      ["_HtmlTable:before", "*", "HtmlTableBody"],

      ["HtmlTableHead", "*", "HtmlTableBody"], // We need to have a body :-)
      ["HtmlTableBody", "tfoot", "HtmlTableFoot"],
    ],
    states: [
      _newState({
        key: "HtmlTableHead",
        token: "thead",
        content: "_HtmlTableRows",
        closingTokens: ["tbody", "tfoot", "table:close"],
        transitions: [["*", "*", "_HtmlTableRows"]],
      }),
      _newState({
        key: "HtmlTableBody",
        token: "tbody",
        content: "_HtmlTableRows",
        closingTokens: ["table:close", "tfoot"],
        transitions: [["*", "*", "_HtmlTableRows"]],
      }),
      _newState({
        key: "HtmlTableFoot",
        token: "tfoot",
        content: "_HtmlTableRows",
        closingTokens: ["table:close"],
        transitions: [["*", "*", "_HtmlTableRows"]],
      }),
      _newState({
        key: "_HtmlTableRows",
        content: "HtmlTableRow",
        transitions: [["*", "tr", "HtmlTableRow"]],
      }),
      _newState({
        key: "HtmlTableRow",
        token: "tr",
        selfClosing: true,
        content: "HtmlTableDCell",
        closingTokens: [
          "thead",
          "thead:close",
          "tbody",
          "tbody:close",
          "tfoot",
          "tfoot:close",
          "table",
          "table:close",
        ],
        transitions: [
          ["_HtmlTableRow:before", "th", "HtmlTableHCell"],

          ["*", "th", "HtmlTableHCell"],
          ["*", "td", "HtmlTableDCell"],
          ["", "*", "HtmlTableDCell"],
        ],
        states: [
          _newState({
            key: "HtmlTableHCell",
            token: "th",
            content: "_HtmlTableCell",
          }),
          _newState({
            key: "HtmlTableDCell",
            token: "td",
            content: "_HtmlTableCell",
          }),
          _newState({
            key: "_HtmlTableCell",
            tokens: ["th", "td"],
            selfClosing: true,
            content: "_HtmlTableCellContent",
            closingTokens: [
              "tr",
              "tr:close",
              "thead",
              "thead:close",
              "tbody",
              "tbody:close",
              "tfoot",
              "tfoot:close",
              "table",
              "table:close",
            ],
            transitions: [["*", "*", "_HtmlTableCellContent"]],
            states: [
              addBlockTransitions(
                addInlineTransitions(
                  _newState({
                    key: "_HtmlTableCellContent",
                    closingTokens: [
                      "td",
                      "td:close",
                      "th",
                      "th:close",
                      "tr",
                      "tr:close",
                      "thead",
                      "thead:close",
                      "tbody",
                      "tbody:close",
                      "tfoot",
                      "tfoot:close",
                      "table",
                      "table:close",
                    ],
                  })
                )
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

function newHeaders() {
  return addInlineTransitions(
    _newState({
      key: "HtmlHeader",
      tokens: ["h1", "h2", "h3", "h4", "h5", "h6"],
      selfClosing: true,
    })
  );
}

function newHtmlP() {
  return addInlineTransitions(
    _newState({
      key: "HtmlParagraph",
      token: "p",
      // content : "Text"
    })
  );
}

function newHtmlBody() {
  return addBlockTransitions(
    _newState({
      key: "HtmlBody",
      token: "body",
      transitions: [["*", "space", "_Ignore"]],
    })
  );
}

function newInlineElement() {
  return _newState({
    key: "InlineElement",
    tokens: ["em", "i", "strong", "b", "img"],
    // content: "Text",
    transitions: [
      ["", "text", "Text"],
      ["*", "text", "Text"],
    ],
  });
}

function newHtml() {
  return {
    key: "Html",
    transitions: [
      ["*", "*", "_DocDispatch"],
      ["*", "html", "HtmlDocument"],
      ["*", "head", "HtmlDocument"],
      ["*", "body", "HtmlDocument"],
    ],
    states: [
      {
        key: "HtmlDocument",
        transitions: [
          ["", "head", "HtmlHead"],
          ["", "body", "HtmlBody"],

          ["HtmlHead", "*", "HtmlBody"],
        ],
        states: [
          {
            key: "HtmlHead",
            transitions: [
              ["", "*", "_Ignore"],

              ["*", "space", "_Ignore"],
              ["*", "link", "HtmlLink"],
              ["*", "script", "HtmlScript"],
              ["*", "meta", "HtmlMeta"],
              ["*", "style", "HtmlStyle"],
              ["*", "text", "_HtmlHeadDispatch"],
            ],
          },
          newHtmlBody(),

          newInlineElement(),

          newHtmlUl(),
          newHtmlOl(),
          newHtmlDl(),
          newHtmlP(),
          newHtmlTable(),
          ////////////
        ],
      },
    ],
  };
}

describe("newSyncProcess", () => {
  function newProcessTest(config, showHidden = false) {
    config = addExitTransitions(config);

    let traces = [];
    const fullTraces = [];
    let process;

    const print = (msg) => {
      if (!process.current) return;
      let shift = "";
      if (showHidden || process.current.key[0] !== "_") {
        for (let i = 0; i <= process.stack.length; i++) {
          if (
            process.stack[i] &&
            !showHidden &&
            process.stack[i].key[0] === "_"
          )
            continue;
          shift += "  ";
        }
        traces.push(shift + msg);
      }

      shift = "";
      for (let i = 0; i <= process.stack.length; i++) {
        shift += "  ";
      }
      fullTraces.push(shift + msg);
    };

    process = newSyncProcess({
      config,
      before: ({ current: state, event }) => {
        const { key, ...options } = event;
        print(`<${state.key} event='${key}'>`);
      },
      after: ({ current: state }) => {
        print(`</${state.key}>`);
      },
    });

    return (type, control) => {
      process.dispatch({ key: type });
      try {
        expect(traces).toEqual(control);
      } catch (error) {
        console.log(JSON.stringify(fullTraces, null, 2));
        console.log(traces.map((v) => `"${v}",`).join("\n"));
        throw error;
      } finally {
        traces = [];
      }
    };
  }

  it(`should iterate over states and perform required state transitions`, async () => {
    const test = newProcessTest(newHtml());

    test("enter", ["  <Html event='enter'>"]);
    test("head", [
      "    <HtmlDocument event='head'>",
      "      <HtmlHead event='head'>",
    ]);
    test("link", ["        <HtmlLink event='link'>"]);
    test("script", [
      "        </HtmlLink>",
      "        <HtmlScript event='script'>",
    ]);
    test("style", [
      "        </HtmlScript>",
      "        <HtmlStyle event='style'>",
    ]);

    test("p", [
      "        </HtmlStyle>",
      "      </HtmlHead>",
      "      <HtmlBody event='p'>",
      "        <HtmlParagraph event='p'>",
    ]);

    test("text", [
      "          <InlineElement event='text'>",
      "            <Text event='text'>",
    ]);

    test("table", [
      "            </Text>",
      "          </InlineElement>",
      "        </HtmlParagraph>",
      "        <HtmlTable event='table'>",
    ]);
    test("thead", ["          <HtmlTableHead event='thead'>"]);

    test("td", [
      "            <HtmlTableRow event='td'>",
      "              <HtmlTableDCell event='td'>",
    ]);
    test("text", [
      "                <InlineElement event='text'>",
      "                  <Text event='text'>",
    ]);

    test("tbody", [
      "                  </Text>",
      "                </InlineElement>",
      "              </HtmlTableDCell>",
      "            </HtmlTableRow>",
      "          </HtmlTableHead>",
      "          <HtmlTableBody event='tbody'>",
    ]);
    test("td", [
      "            <HtmlTableRow event='td'>",
      "              <HtmlTableDCell event='td'>",
    ]);
    test("text", [
      "                <InlineElement event='text'>",
      "                  <Text event='text'>",
    ]);

    test("tr", [
      "                  </Text>",
      "                </InlineElement>",
      "              </HtmlTableDCell>",
      "            </HtmlTableRow>",
      "            <HtmlTableRow event='tr'>",
    ]);

    test("text", [
      "              <HtmlTableDCell event='text'>",
      "                <InlineElement event='text'>",
      "                  <Text event='text'>",
    ]);

    test("tbody:close", [
      "                  </Text>",
      "                </InlineElement>",
      "              </HtmlTableDCell>",
      "            </HtmlTableRow>",
    ]);
    test("text", [
      "            <HtmlTableRow event='text'>",
      "              <HtmlTableDCell event='text'>",
      "                <InlineElement event='text'>",
      "                  <Text event='text'>",
    ]);

    test("table:close", [
      "                  </Text>",
      "                </InlineElement>",
      "              </HtmlTableDCell>",
      "            </HtmlTableRow>",
      "          </HtmlTableBody>",
    ]);
    test("table", [
      "        </HtmlTable>",
      "        <HtmlTable event='table'>",
    ]);
    test("text", [
      "          <HtmlTableBody event='text'>",
      "            <HtmlTableRow event='text'>",
      "              <HtmlTableDCell event='text'>",
      "                <InlineElement event='text'>",
      "                  <Text event='text'>",
    ]);
    test("text", [
      "                  </Text>",
      "                  <Text event='text'>",
    ]);
    test("text", [
      "                  </Text>",
      "                  <Text event='text'>",
    ]);
    test("em", [
      "                  </Text>",
      "                </InlineElement>",
      "                <InlineElement event='em'>",
    ]);
    test("text", ["                  <Text event='text'>"]);

    test("tr", [
      "                  </Text>",
      "                </InlineElement>",
      "              </HtmlTableDCell>",
      "            </HtmlTableRow>",
      "            <HtmlTableRow event='tr'>",
    ]);
    test("strong", [
      "              <HtmlTableDCell event='strong'>",
      "                <InlineElement event='strong'>",
    ]);
    test("text", ["                  <Text event='text'>"]);

    test("th", [
      "                  </Text>",
      "                </InlineElement>",
      "              </HtmlTableDCell>",
      "              <HtmlTableHCell event='th'>",
    ]);

    test("text", [
      "                <InlineElement event='text'>",
      "                  <Text event='text'>",
    ]);

    test("dt", [
      "                  </Text>",
      "                </InlineElement>",
      "                <HtmlDl event='dt'>",
      "                  <HtmlDt event='dt'>",
    ]);
    test("text", [
      "                    <InlineElement event='text'>",
      "                      <Text event='text'>",
    ]);

    test("dd", [
      "                      </Text>",
      "                    </InlineElement>",
      "                  </HtmlDt>",
      "                  <HtmlDd event='dd'>",
    ]);
    test("text", [
      "                    <InlineElement event='text'>",
      "                      <Text event='text'>",
    ]);

    test("dd", [
      "                      </Text>",
      "                    </InlineElement>",
      "                  </HtmlDd>",
      "                  <HtmlDd event='dd'>",
    ]);
    test("text", [
      "                    <InlineElement event='text'>",
      "                      <Text event='text'>",
    ]);
    test("em", [
      "                      </Text>",
      "                    </InlineElement>",
      "                    <InlineElement event='em'>",
    ]);
    test("text", ["                      <Text event='text'>"]);

    test("td", [
      "                      </Text>",
      "                    </InlineElement>",
      "                    <HtmlTable event='td'>",
      "                      <HtmlTableBody event='td'>",
      "                        <HtmlTableRow event='td'>",
      "                          <HtmlTableDCell event='td'>",
    ]);
    test("text", [
      "                            <InlineElement event='text'>",
      "                              <Text event='text'>",
    ]);

    test("table:close", [
      "                              </Text>",
      "                            </InlineElement>",
      "                          </HtmlTableDCell>",
      "                        </HtmlTableRow>",
      "                      </HtmlTableBody>",
    ]);

    test("text", [
      "                    </HtmlTable>",
      "                    <InlineElement event='text'>",
      "                      <Text event='text'>",
    ]);

    test("dl:close", [
      "                      </Text>",
      "                    </InlineElement>",
      "                  </HtmlDd>",
    ]);

    test("text", [
      "                </HtmlDl>",
      "                <InlineElement event='text'>",
      "                  <Text event='text'>",
    ]);

    test("table:close", [
      "                  </Text>",
      "                </InlineElement>",
      "              </HtmlTableHCell>",
      "            </HtmlTableRow>",
      "          </HtmlTableBody>",
    ]);

    test("li", [
      "        </HtmlTable>",
      "        <HtmlUl event='li'>",
      "          <HtmlLi event='li'>",
    ]);
    test("text", [
      "            <InlineElement event='text'>",
      "              <Text event='text'>",
    ]);

    test("dl", [
      "              </Text>",
      "            </InlineElement>",
      "            <HtmlDl event='dl'>",
    ]);
    test("li", [
      "              <HtmlDd event='li'>",
      "                <HtmlUl event='li'>",
      "                  <HtmlLi event='li'>",
    ]);

    test("text", [
      "                    <InlineElement event='text'>",
      "                      <Text event='text'>",
    ]);
    test("exit", [
      "                      </Text>",
      "                    </InlineElement>",
      "                  </HtmlLi>",
      "                </HtmlUl>",
      "              </HtmlDd>",
      "            </HtmlDl>",
      "          </HtmlLi>",
      "        </HtmlUl>",
      "      </HtmlBody>",
      "    </HtmlDocument>",
      "  </Html>",
    ]);
  });
});
