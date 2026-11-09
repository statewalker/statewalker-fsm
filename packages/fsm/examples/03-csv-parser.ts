/**
 * Example 3 — a character-level parser on the sync engine.
 *
 * A sync machine is a good fit for tokenizers: one `dispatch` per input symbol,
 * no promise allocation, and the result is ready as soon as the loop ends. This
 * parses one CSV line (RFC 4180 quoting: `"a,b"` and doubled `""` escapes).
 *
 * An event with no matching rule unwinds the whole machine (`dispatch` returns
 * `false`) — that is exactly how a syntax error is detected here.
 *
 * Run: node examples/03-csv-parser.ts 'a,"b,c",d'
 */
import { fileURLToPath } from "node:url";
import { FsmProcessSync, type FsmStateConfig } from "../src/index.ts";

export const csvLine: FsmStateConfig = {
  key: "CsvLine",
  transitions: [
    ["", "*", "FieldStart"],
    ["FieldStart", "comma", "FieldStart"],
    ["FieldStart", "quote", "Quoted"],
    ["FieldStart", "char", "Unquoted"],
    ["FieldStart", "end", ""],
    ["Unquoted", "char", "Unquoted"],
    ["Unquoted", "comma", "FieldStart"],
    ["Unquoted", "end", ""],
    ["Quoted", "char", "Quoted"],
    ["Quoted", "comma", "Quoted"],
    ["Quoted", "quote", "QuoteInQuoted"],
    ["QuoteInQuoted", "quote", "Quoted"], // "" → a literal quote
    ["QuoteInQuoted", "comma", "FieldStart"],
    ["QuoteInQuoted", "end", ""],
  ],
};

const classify = (ch: string) => (ch === '"' ? "quote" : ch === "," ? "comma" : "char");

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let ch = "";

  const fsm = new FsmProcessSync(csvLine);
  fsm.onStateCreate((state) => {
    switch (state.key) {
      case "FieldStart":
        state.onEnter(() => {
          if (fsm.event === "comma") fields.push(field);
          field = "";
        });
        break;
      case "Unquoted":
        state.onEnter(() => {
          field += ch;
        });
        break;
      case "Quoted":
        state.onEnter(() => {
          if (fsm.event !== "quote") field += ch;
        });
        break;
      case "QuoteInQuoted":
        state.onExit(() => {
          if (fsm.event === "quote") field += '"';
        });
        break;
      case "CsvLine":
        state.onExit(() => {
          if (fsm.event === "end") fields.push(field);
        });
        break;
    }
  });

  fsm.dispatch("");
  for (let i = 0; i < line.length; i++) {
    ch = line[i];
    if (!fsm.dispatch(classify(ch))) {
      throw new SyntaxError(`Unexpected ${JSON.stringify(ch)} at position ${i}`);
    }
  }
  if (fsm.state?.key === "Quoted") throw new SyntaxError("Unterminated quoted field");
  fsm.dispatch("end");
  return fields;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = process.argv[2] ?? 'id,"name, full","say ""hi""",'; // trailing empty field
  console.log(input, "→", parseCsvLine(input));
}
