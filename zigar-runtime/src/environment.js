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
  const props = {};
  const constructor = function() {
    for (const [ name, object ] of Object.entries(props)) {
      this[name] = structuredClone(object);
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
      if (typeof(object) === 'function') {
        if (process.env.MIXIN === 'track') {
          props.mixinUsage = new Map();
          const f = function(...args) {
            this.mixinUsage.set(mixin, true);
            return object.call(this, ...args);
          }
          defineProperty(prototype, name, defineValue(f));
        } else {
          defineProperty(prototype, name, defineValue(object));
        }
      } else {
        let current = props[name];
        if (current !== undefined) {
          if (current?.constructor === Object) {
            object = Object.assign({ ...current }, object);
          } else if (current !== object) {
            throw new Error(`Duplicate property: ${name}`);
          }
        }
        props[name] = object;
      }
    }
  }
  return constructor;
}
