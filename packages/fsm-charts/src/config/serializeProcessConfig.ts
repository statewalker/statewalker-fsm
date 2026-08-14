import type { FsmStateConfig } from "../types/index.js";

export function serializeProcessConfig(config: FsmStateConfig | undefined) {
  if (!config) return "";
  const lines: string[] = [];
  visit(config, lines);
  return lines.join("\n");

  function visit(config: FsmStateConfig, lines: string[], shift = "") {
    lines.push(`${shift}{`);
    const { key, states, transitions, ...params } = config;
    lines.push(`${shift}  "key": ${JSON.stringify(key)}`);
    if (transitions && transitions.length > 0) {
      lines[lines.length - 1] += ",";
      lines.push(`${shift}  "transitions": [`);
      for (let i = 0; i < transitions.length; i++) {
        if (i > 0) {
          lines[lines.length - 1] += ",";
        }
        lines.push(`${shift}    ${JSON.stringify(transitions[i])}`);
      }
      lines.push(`${shift}  ]`);
    }

    if (states && states.length > 0) {
      lines[lines.length - 1] += ",";
      lines.push(`${shift}  "states": [`);
      for (let i = 0; i < states.length; i++) {
        if (i > 0) {
          lines[lines.length - 1] += ",";
        }
        visit(states[i], lines, `${shift}    `);
      }
      lines.push(`${shift}  ]`);
    }

    if (params && Object.keys(params).length > 0) {
      lines[lines.length - 1] += ",";
      const str = JSON.stringify(params, null, 2);
      const paramsLines = str.split("\n");
      paramsLines.shift();
      paramsLines.pop();
      lines.push(...paramsLines.map((line) => shift + line));
    }
    lines.push(`${shift}}`);
  }
}
