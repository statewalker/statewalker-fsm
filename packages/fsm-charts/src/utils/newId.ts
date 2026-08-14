export function newId(prefix: string = "id"): string {
  const ns = newId as any;
  const id = (ns._idCounter = (ns._idCounter || 0) + 1);
  return `${prefix}_${id}`;
}
