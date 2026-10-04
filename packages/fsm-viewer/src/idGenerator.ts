export function newIdGenerator(idCounter = 0) {
  return function newId(prefix = "id") {
    idCounter = (idCounter || 0) + 1;
    const id = idCounter;
    return `${prefix}_${id}`;
  };
}

export const newId = newIdGenerator(0);
