import { defineProperty, defineValue } from './utils.js';

const cls = {
  name: '',
  mixins: [],
  constructor: null,
};

function reset() {
  cls.name = '';
  cls.constructor = null;
  cls.mixins = [];
}

function name(s) {
  cls.name = s;
}

function mixin(object) {
  if (!cls.constructor) {
    cls.mixins.push(object);
  }
  return object;
}

function defineEnvironment() {
  if (!cls.constructor) {
    cls.constructor = defineClass(cls.name, cls.mixins);
    cls.name = '';
    cls.mixins = [];
  }
  return cls.constructor;
}

function defineClass(name, mixins) {
  const props = {};
  const constructor = function() {
    for (const [ name, object ] of Object.entries(props)) {
      this[name] = structuredClone(object);
    }
  };
  const { prototype } = constructor;
  defineProperty(constructor, 'name', defineValue(name));
  for (const mixin of mixins) {
    for (let [ name, object ] of Object.entries(mixin)) {
      if (typeof(object) === 'function') {
        {
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

export { defineClass, defineEnvironment, mixin, name, reset };
