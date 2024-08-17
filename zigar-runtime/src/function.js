import { TypeMismatch } from './error';
import { defineProperties, ObjectCache } from './object';
import { MEMORY, VARIANT_CREATOR } from './symbol';

export function defineFunction(structure, env) {
  const {
    name,
    instance: { members: [ member ], template },
  } = structure;
  const cache = new ObjectCache();
  const { structure: { constructor: Arg, instance: { members: argMembers } } } = member;
  const argCount = argMembers.length - 1;
  const constructor = structure.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv, caller;
    if (creating) {
      if (arguments.length === 0) {
        throw new NoInitializer(structure);
      }
      if (typeof(arg) !== 'function') {
        throw new TypeMismatch('function', arg);
      }
      dv = env.getFunctionThunk(arg);
    } else {
      dv = arg;
    }
    if (self = cache.find(dv)) {
      return self;
    }
    if (creating) {
      const f = arg;
      caller = function(argStruct) {
        const args = [];
        for (let i = 0; i < argCount; i++) {
          args.push(argStruct[i]);
        }
        argStruct.retval = f(...args);
      };
      self = anonymous(function(...args) {
        return arg(...args);
      });
      env.attachThunkCaller(dv, caller);
    } else {
      caller = function(argStruct) {
        const thunkAddr = env.getViewAddress(template[MEMORY]);
        const funcAddr = env.getViewAddress(self[MEMORY]);
        env.invokeThunk(thunkAddr, funcAddr, argStruct);
      };
      self = anonymous(function (...args) {
        const argStruct = new Arg(args, self.name, 0);
        caller(argStruct);
        return argStruct.retval;
      });
    }
    Object.setPrototypeOf(self, constructor.prototype);
    self[MEMORY] = dv;
    const creator = function (type) {
      let variant, argCount;
      if (type === 'method') {
        variant = function(...args) {
          const argStruct = new Arg([ this, ...args ], variant.name, 1);
          caller(argStruct);
          return argStruct.retval;
        };
        argCount = argMembers.length - 2;
      }
      defineProperties(variant, {
        length: { value: argCount, writable: false },
      });
      return variant;
    };
    defineProperties(self, {
      length: { value: argCount, writable: false },
      [VARIANT_CREATOR]: { value: creator },
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

