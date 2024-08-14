import { defineProperties, ObjectCache } from './object';
import { MEMORY, VARIANT_CREATOR } from './symbol';

export function defineFunction(structure, env) {
  const {
    name,
    instance: { members: [ member ], template },
  } = structure;
  const cache = new ObjectCache();
  const { structure: { constructor: Arg, instance: { members: argMembers } } } = member;
  const constructor = structure.constructor = function(dv) {
    let self;
    if (self = cache.find(dv)) {
      return self;
    }
    const invoke = function(argStruct) {
      const thunkAddr = env.getViewAddress(template[MEMORY]);
      const funcAddr = env.getViewAddress(self[MEMORY]);
      return env.invokeThunk(thunkAddr, funcAddr, argStruct);
    };
    self = anonymous(function (...args) {
      return invoke(new Arg(args, self.name, 0));
    })
    Object.setPrototypeOf(self, constructor.prototype);
    self[MEMORY] = dv;
    const variantCreator = function (type) {
      let variant, argCount;
      if (type === 'method') {
        variant = function(...args) {
          return invoke(new Arg([ this, ...args ], variant.name, 1));
        };
        argCount = argMembers.length - 2;
      }
      defineProperties(variant, {
        length: { value: argCount, writable: false },
      });
      return variant;
    };
    defineProperties(self, {
      length: { value: argMembers.length - 1, writable: false },
      [VARIANT_CREATOR]: { value: variantCreator },
    });
    cache.save(dv, self);
    return self;
  };
  constructor.prototype = Object.create(Function.prototype);
  defineProperties(constructor.prototype, {
    constructor: { value: constructor },
  });
  return constructor;
}

function anonymous(f) {
  return f
};

