import type { RuleFunction, RuleId } from "../types.ts";
import { lexicalRules } from "./lexical.ts";
import { semanticRules } from "./semantic.ts";
import { structuralRules } from "./structural.ts";

export const allRules: Map<RuleId, RuleFunction> = new Map([
  ...lexicalRules,
  ...structuralRules,
  ...semanticRules,
]);

export { lexicalRules } from "./lexical.ts";
export { semanticRules } from "./semantic.ts";
export { structuralRules } from "./structural.ts";
