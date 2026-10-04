export type Registry = [
  register: (action: () => unknown) => (skipCall?: boolean) => void,
  clear: () => void,
  unregister: (action: () => unknown) => void,
];

export function newRegistry(onError: (error: any) => unknown = console.error): Registry {
  let counter = 0;
  const registrations: Record<number, ((skip?: boolean) => void) & { action: () => void }> = {};
  const register = (action: () => unknown) => {
    const id = counter++;
    const registration = Object.assign(
      (skip?: boolean) => {
        try {
          delete registrations[id];
          return !skip && action && action();
        } catch (error) {
          onError(error);
        }
      },
      { action },
    );
    registrations[id] = registration;
    return registration;
  };
  const unregister = (action: () => void) => {
    for (const r of Object.values(registrations)) if (r.action === action) r(true);
  };
  const clear = () => {
    for (const r of Object.values(registrations)) r();
  };
  return [register, clear, unregister];
}
