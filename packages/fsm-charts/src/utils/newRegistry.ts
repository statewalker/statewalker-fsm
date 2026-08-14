export type Registry = [
  register: (action: () => unknown) => (skipCall?: boolean) => void,
  clear: () => void,
  unregister: (action: () => unknown) => void,
];

export function newRegistry(
  onError: (error: any) => unknown = console.error,
): Registry {
  let counter = 0;
  const registrations: Record<
    number,
    ((skip?: boolean) => void) & { action: () => void }
  > = {};
  const register = (action: () => unknown) => {
    const id = counter++;
    return (registrations[id] = Object.assign(
      (skip?: boolean) => {
        try {
          delete registrations[id];
          return !skip && action && action();
        } catch (error) {
          onError(error);
        }
      },
      { action },
    ));
  };
  const unregister = (action: () => void) =>
    Object.values(registrations).forEach((r) => r.action === action && r(true));
  const clear = () => Object.values(registrations).forEach((r) => r());
  return [register, clear, unregister];
}
