export function newIdGenerator(idCounter = 0) {
  return function newId(prefix = "id") {
    const id = (idCounter = (idCounter || 0) + 1);
    return `${prefix}_${id}`;
  };
}

export const newId = newIdGenerator(0);
