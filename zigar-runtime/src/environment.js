import { defineProperty, defineValue } from './utils.js';

const cls = {
  name: '',
  mixins: [],
  constructor: null,
};

export function reset() {
  cls.name = '';
  cls.constructor = null;
  cls.mixins = [];
}

export function name(s) {
  cls.name = s;
}

export function mixin(object) {
  if (!cls.constructor) {
    cls.mixins.push(object);
  }
  return object;
}

export function defineEnvironment() {
  if (!cls.constructor) {
    cls.constructor = defineClass(cls.name, cls.mixins);
    cls.name = '';
    cls.mixins = [];
  }
  return cls.constructor;
}

export function defineClass(name, mixins) {
  const initFunctions = [];
  const constructor = function() {
    for (const init of initFunctions) {
      init.call(this);
    }
    if (process.env.DEV) {
      const diag = globalThis.ZIGAR = Object.create(null);
      const descriptors = Object.getOwnPropertyDescriptors(prototype);
      for (const [ name, desc ] of Object.entries(descriptors)) {
        if (typeof(desc.value) === 'function') {
          const m = /^diag(.*)/.exec(name);
          if (m) {
            const value = desc.value.bind(this);
            defineProperty(diag, m[1], { value, enumerable: true });
          }
        }
      }
    }
  };
  if (process.env.DEV) {
    const map = new Map();
    for (const mixin of mixins) {
      if (map.get(mixin)) {
        throw new Error('Duplicate mixin');
      }
      map.set(mixin, true);
    }
  }
  const { prototype } = constructor;
  defineProperty(constructor, 'name', defineValue(name));
  for (const mixin of mixins) {
    for (let [ name, object ] of Object.entries(mixin)) {
      if (name === 'init') {
        initFunctions.push(object);
      } else {
        if (typeof(object) === 'function') {
          if (process.env.MIXIN === 'track') {
            const func = object;
            object = function(...args) {
              this.mixinUsageCapturing?.set(mixin, true);
              return func.call(this, ...args);
            }
          }
        } else {
          let current = prototype[name];
          if (current !== undefined) {
            if (current?.constructor === Object) {
              object = Object.assign({ ...current }, object);
            } else if (current !== object) {
              throw new Error(`Duplicate property: ${name}`);
            }
          }
        }
        defineProperty(prototype, name, defineValue(object));
      }
    }
  }
  return constructor;
}
