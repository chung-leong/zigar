import { TypeMismatch } from './error';
import { defineProperties, ObjectCache } from './object';
import { MEMORY, VARIANT_CREATOR } from './symbol';

export function defineFunction(structure, env) {
  const {
    name,
    instance: { members: [ member ], template: thunk },
    static: { template: jsThunkConstructor },
  } = structure;
  const cache = new ObjectCache();
  const { structure: { constructor: Arg, instance: { members: argMembers } } } = member;
  const argCount = argMembers.length - 1;
  const constructor = structure.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv, method, direct, funcId;
    if (creating) {
      if (arguments.length === 0) {
        throw new NoInitializer(structure);
      }
      if (typeof(arg) !== 'function') {
        throw new TypeMismatch('function', arg);
      }
      const constuctorAddr = env.getViewAddress(jsThunkConstructor[MEMORY]);
      funcId = env.getFunctionId(arg);
      dv = env.getFunctionThunk(constuctorAddr, funcId);
    } else {
      dv = arg;
    }
    if (self = cache.find(dv)) {
      return self;
    }
    if (creating) {
      const fn = arg;
      self = anonymous(function(...args) {
        return fn(...args);
      });
      method = function(...args) {
        return fn([ this, ...args]);
      }
      direct = function(dv) {
        const argStruct = Arg(dv);
        const args = [];
        for (let i = 0; i < argCount; i++) {
          args.push(argStruct[i]);
        }
        argStruct.retval = fn(...args);
      };
      env.setFunctionCaller(dv, direct);
    } else {
      const invoke = function(argStruct) {
        const thunkAddr = env.getViewAddress(thunk[MEMORY]);
        const funcAddr = env.getViewAddress(self[MEMORY]);
        env.invokeThunk(thunkAddr, funcAddr, argStruct);
      };
      self = anonymous(function (...args) {
        const argStruct = new Arg(args, self.name, 0);
        invoke(argStruct);
        return argStruct.retval;
      });
      method = function(...args) {
        const argStruct = new Arg([ this, ...args ], variant.name, 1);
        invoke(argStruct);
        return argStruct.retval;
      };
      direct = function(dv) {
        invoke(Arg(dv));
      };
    }
    Object.setPrototypeOf(self, constructor.prototype);
    self[MEMORY] = dv;
    const creator = function (type) {
      let variant, argCount;
      if (type === 'method') {
        variant = method;
        argCount = argMembers.length - 2;
      } else if (type === 'direct') {
        variant = direct;
        argCount = 1;
      }
      defineProperties(variant, {
        length: { value: argCount, writable: false },
        name: { get: () => self.name },
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

