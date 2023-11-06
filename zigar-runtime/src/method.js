export function addMethods(s, env) {
  const {
    constructor,
    instance: { methods: instanceMembers },
    static: { methods: staticMethods },
  } = s;
  for (const method of staticMethods) {
    const f = env.createCaller(method, false);
    Object.defineProperty(constructor, f.name, { value: f, configurable: true, writable: true });
  }
  for (const method of instanceMembers) {
    const f = env.createCaller(method, true);
    Object.defineProperty(Object.prototype, f.name, { value: f, configurable: true, writable: true });
  }
}
