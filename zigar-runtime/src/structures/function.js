import { mixin } from '../environment.js';
import { NoInitializer, TypeMismatch } from '../errors.js';
import { MEMORY, VARIANTS } from '../symbols.js';
import { defineProperties, defineValue, getSelf, ObjectCache } from '../utils.js';

export default mixin({
  defineFunction(structure, descriptors) {
    const {
      instance: { members: [ member ], template: thunk },
      static: { template: jsThunkController },
    } = structure;
    const cache = new ObjectCache();
    const { structure: { constructor: ArgStruct } } = member;
    const thisEnv = this;
    const constructor = function(arg) {
      const creating = this instanceof constructor;
      let dv;
      if (creating) {
        // creating a Zig function object from a JavaScript function
        if (arguments.length === 0) {
          throw new NoInitializer(structure);
        }
        if (typeof(arg) !== 'function') {
          throw new TypeMismatch('function', arg);
        }
        // create an inbound thunk for function (from mixin "features/call-marshaling-inbound")
        dv = thisEnv.getFunctionThunk(arg, jsThunkController);
      } else {
        // casting a memory pointing to Zig binary
        dv = arg;
      }
      let existing;
      if (existing = cache.find(dv)) {
        return existing;
      }
      const argCount = ArgStruct.prototype.length;
      const { self, method, binary } = (creating)
      ? thisEnv.createInboundCallers(arg, ArgStruct)
      : thisEnv.createOutboundCallers(thunk, ArgStruct);
      defineProperties(self, {
        length: defineValue(argCount),
        [VARIANTS]: defineValue({ method, binary }),
        name: defineValue(''),
      });
      defineProperties(method, {
        length: defineValue(argCount - 1),
        name: {
          get() {
            return self.name;
          },
        }
      });
      // make self an instance of this function type
      Object.setPrototypeOf(self, constructor.prototype);
      self[MEMORY] = dv;
      cache.save(dv, self);
      if (process.env.MIXIN === 'track') {
        if (!creating) {
          thisEnv.usingFunction = true;
        }
      }
      return self;
    };
    // make function type a superclass of Function
    Object.setPrototypeOf(constructor.prototype, Function.prototype);
    // don't change the tag of functions
    descriptors[Symbol.toStringTag] = undefined;
    descriptors.valueOf = descriptors.toJSON = defineValue(getSelf);
    if (process.env.MIXIN === 'track') {
      if (jsThunkController) {
        this.usingFunctionPointer = true;
      }
    }
    return constructor;
  },
  ...(process.env.MIXIN === 'track' ? {
    usingFunction: false,
    usingFunctionPointer: false,
  } : undefined),
});
