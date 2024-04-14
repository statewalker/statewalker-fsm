export function bindMethods<T>(obj: T, ...methods: string[]) {
  const o = obj as any;
  methods.forEach((methodName) => {
    o[methodName] = (o[methodName] as Function).bind(o);
  });
  return obj;
}
