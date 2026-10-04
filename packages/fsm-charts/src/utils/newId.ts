export function newId(prefix: string = "id"): string {
  const ns = newId as any;
  ns._idCounter = (ns._idCounter || 0) + 1;
  const id = ns._idCounter;
  return `${prefix}_${id}`;
}
