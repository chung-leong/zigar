import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { ALIGN, MEMORY, VARIANTS } from '../symbols.js';
import { defineProperties, ObjectCache } from '../utils.js';

export default mixin({
  defineFunction(structure) {
    const {
      name,
      instance: { members: [ member ], template: thunk },
      static: { template: jsThunkConstructor },
    } = structure;
    const thisEnv = this;
    const cache = new ObjectCache();
    const { structure: { constructor: Arg, instance: { members: argMembers } } } = member;
    const argCount = argMembers.length - 1;
    const constructor = structure.constructor = function(arg) {
      const creating = this instanceof constructor;
      let self, method, binary;
      let dv, funcId;
      if (creating) {
        if (arguments.length === 0) {
          throw new NoInitializer(structure);
        }
        if (typeof(arg) !== 'function') {
          throw new TypeMismatch('function', arg);
        }
        const constuctorAddr = thisEnv.getViewAddress(jsThunkConstructor[MEMORY]);
        funcId = thisEnv.getFunctionId(arg);
        dv = thisEnv.getFunctionThunk(constuctorAddr, funcId);
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
        binary = function(dv, asyncCallHandle) {
          let result = CallResult.OK;
          let awaiting = false;
          try {
            const argStruct = Arg(dv);
            const args = [];
            for (let i = 0; i < argCount; i++) {
              args.push(argStruct[i]);
            }
            const retval = fn(...args);
            if (retval?.[Symbol.toStringTag] === 'Promise') {
              if (asyncCallHandle) {
                retval.then((value) => {
                  argStruct.retval = value;
                }).catch((err) => {
                  console.error(err);
                  result = CallResult.Failure;
                }).then(() => {
                  thisEnv.finalizeAsyncCall(asyncCallHandle, result);
                });
                awaiting = true;
              } else {
                result = CallResult.Deadlock;
              }
            } else {
              argStruct.retval = retval;
            }
          } catch (err) {
            console.error(err);
            result = CallResult.Failure;
          }
          if (!awaiting && asyncCallHandle) {
            thisEnv.finalizeAsyncCall(asyncCallHandle, result);
          }
          return result;
        };
        thisEnv.setFunctionCaller(funcId, binary);
      } else {
        const invoke = function(argStruct) {
          const thunkAddr = thisEnv.getViewAddress(thunk[MEMORY]);
          const funcAddr = thisEnv.getViewAddress(self[MEMORY]);
          thisEnv.invokeThunk(thunkAddr, funcAddr, argStruct);
        };
        self = anonymous(function (...args) {
          const argStruct = new Arg(args, self.name, 0);
          invoke(argStruct);
          return argStruct.retval;
        });
        method = function(...args) {
          const argStruct = new Arg([ this, ...args ], self.name, 1);
          invoke(argStruct);
          return argStruct.retval;
        };
        binary = function(dv) {
          invoke(Arg(dv));
        };
      }
      Object.setPrototypeOf(self, constructor.prototype);
      self[MEMORY] = dv;
      defineProperties(self, {
        length: { value: argCount, writable: false },
        [VARIANTS]: { value: { method, binary } },
      });
      defineProperties(method, {
        length: { value: argCount - 1, writable: false },
        name: { get: () => self.name },
      });
      cache.save(dv, self);
      return self;
    };
    constructor.prototype = Object.create(Function.prototype);
    defineProperties(constructor.prototype, {
      constructor: { value: constructor },
    });
    defineProperties(constructor, {
      [ALIGN]: { value: 1 },
    });
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Function;
}

export const CallResult = {
  OK: 0,
  Failure: 1,
  Deadlock: 2,
  Disabled: 3,
};

function anonymous(f) {
  return f
};

