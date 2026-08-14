export function newTreeBuilder<T extends unknown[] = []>(context: {
  enter: (level: number, ...params: T) => void;
  exit: (level: number, ...params: T) => void;
}) {
  let level = -1;
  return (newLevel: number, ...params: T) => {
    while (level >= 0 && level >= newLevel) {
      context.exit(level--, ...params);
    }
    while (level < newLevel) {
      context.enter(++level, ...params);
    }
  };
}
