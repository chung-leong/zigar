import { defineProperty } from './utils.js';

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
  const props = {
    littleEndian: true,
  };
  const constructor = function() {
    Object.assign(this, props);
  };
  const { prototype } = constructor;
  defineProperty(constructor, 'name', defineValue(name));
  for (const mixin of mixins) {
    for (const [ name, object ] of Object.entries(mixin)) {
      if (typeof(object) === 'function') {
        defineProperty(prototype, name, defineValue(object));
      } else {
        let current = props[name];
        if (current !== undefined) {
          if (typeof(current) === 'object') {
            Object.assign(current, object);
          } else if (current !== object) {
            throw new Error(`Duplicate property: ${name}`);
          }
        } else {
          props[name] = object;
        }
      }
    }
  }
  return constructor;
}
