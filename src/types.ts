export type FsmStateKey = string;
export type FsmEventKey = string;
export type FsmTransition = [
  from: FsmStateKey,
  event: FsmEventKey,
  to: FsmStateKey,
];

export type FsmEvents = Record<FsmEventKey, string>;

export type FsmStateConfig = {
  key: FsmStateKey;
  transitions?: FsmTransition[];
  states?: FsmStateConfig[];
  events?: FsmEvents;
  name?: string;
  description?: string;
  outcome?: string;
  actors?: string[];
  object?: string;
} & Record<string, unknown>;

export type Severity = "error" | "warning" | "info" | "review";

export type RuleId =
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "L5"
  | "L6"
  | "L7"
  | "S1"
  | "S2"
  | "S3"
  | "S4"
  | "S5"
  | "S6"
  | "S7"
  | "S8"
  | "M1"
  | "M2"
  | "M3"
  | "M4"
  | "M5"
  | "M6"
  | "M7"
  | "M8"
  | "M9";

export type ValidationIssue = {
  rule: RuleId;
  severity: Severity;
  message: string;
  path: string[];
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  review: ValidationIssue[];
};

export type ValidationOptions = {
  rules?: RuleId[];
  exclude?: RuleId[];
};

export type RuleContext = {
  config: FsmStateConfig;
  path: string[];
  root: FsmStateConfig;
  parent?: FsmStateConfig;
};

export type RuleFunction = (ctx: RuleContext) => ValidationIssue[];
