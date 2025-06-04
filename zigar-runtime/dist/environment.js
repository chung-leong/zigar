import { defineProperty, defineValue } from './utils.js';

const cls = {
  name: '',
  mixins: [],
};

function reset() {
  cls.name = '';
  cls.mixins = [];
}

function name(s) {
  cls.name = s;
}

function mixin(object) {
  if (!cls.mixins.includes(object)) {
    cls.mixins.push(object);
  }
  return object;
}

function defineEnvironment() {
  return defineClass(cls.name, cls.mixins);
}

function defineClass(name, mixins) {
  const initFunctions = [];
  const constructor = function() {
    for (const init of initFunctions) {
      init.call(this);
    }
  };
  const { prototype } = constructor;
  defineProperty(constructor, 'name', defineValue(name));
  for (const mixin of mixins) {
    for (let [ name, object ] of Object.entries(mixin)) {
      if (name === 'init') {
        initFunctions.push(object);
      } else {
        if (typeof(object) === 'function') ; else {
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

export { defineClass, defineEnvironment, mixin, name, reset };
