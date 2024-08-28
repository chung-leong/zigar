const cls = {
  name: '',
  mixins: [],
  constructor: null,
};

export function name(s) {
  cls.name = s;
}

export function mixin(object) {
  if (!cls.constructor) {
    cls.mixins.push(object);
  }
}

export function defineEnvironment() {
  const props = {};
  if (!cls.constructor) {
    const constructor = cls.constructor = function() {
      Object.assign(this, props);
    };
    defineProperty(constructor, 'name', { value: cls.name });
    for (const mixin of cls.mixins) {
      for (const [ name, object ] of Object.entries(mixin)) {
        if (typeof(object) === 'function') {
          defineProperty(name, { value: object });
        } else {
          props[name] = object;
        }
      }
    }
  }
  return cls.constructor;
}

export function defineProperty(object, name, descriptor) {
  if (descriptor) {
    const {
      set,
      get,
      value,
      enumerable,
      configurable = true,
      writable = true,
    } = descriptor;
    Object.defineProperty(object, name, (get)
      ? { get, set, configurable, enumerable }
      : { value, configurable, enumerable, writable }
    );
  }
}

export function defineProperties(object, descriptors) {
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    defineProperty(object, name, descriptor);
  }
  for (const symbol of Object.getOwnPropertySymbols(descriptors)) {
    const descriptor = descriptors[symbol];
    defineProperty(object, symbol, descriptor);
  }
}
