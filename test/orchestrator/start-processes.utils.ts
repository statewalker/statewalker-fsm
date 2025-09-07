export function addTraces(
  context: Record<string, unknown>,
  ...trace: string[]
) {
  let root = context;
  while (root.parent) {
    root = root.parent as Record<string, unknown>;
  }
  let traces = root.traces as string[];
  if (!traces) {
    root.traces = traces = [];
  }
  traces.push(...trace);
  return traces;
}
