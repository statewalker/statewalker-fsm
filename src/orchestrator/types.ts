export type StageHandler<C = Record<string, unknown>> = (
  context: C,
) =>
  | void
  | (() => void | Promise<void>)
  | Promise<void | (() => void | Promise<void>)>
  | AsyncGenerator<string, void, unknown>
  | Generator<string, void, unknown>;

export function toStageHandlers<C>(
  value: unknown,
  accept: (key: string, value: unknown) => boolean,
): StageHandler<C>[] {
  return visit(value);

  function visit(val: unknown): StageHandler<C>[] {
    if (!val) {
      return [];
    }
    if (typeof val === "function") {
      return [val] as StageHandler<C>[];
    }
    if (typeof val !== "object") {
      return [];
    }
    if (Array.isArray(val)) {
      return val.flatMap(visit);
    }
    const modulesIndex = val as Record<string, unknown>;
    return Object.entries(modulesIndex).flatMap(([key, value]) => {
      return accept(key, value) ? visit(value) : [];
    });
  }
}
