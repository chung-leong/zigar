import { mixin } from '../environment.js';
import { NoCastingToFunction, NoInitializer, TypeMismatch } from '../errors.js';
import { ENVIRONMENT, MEMORY } from '../symbols.js';
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
        if (this !== ENVIRONMENT) {
          // casting from buffer to function is allowed only if request comes from the runtime
          throw new NoCastingToFunction();
        }
        // casting a memory pointing to Zig binary
        dv = arg;
      }
      let existing;
      if (existing = cache.find(dv)) {
        return existing;
      }
      const argCount = ArgStruct.prototype.length;
      const self = (creating)
      ? thisEnv.createInboundCaller(arg, ArgStruct)
      : thisEnv.createOutboundCaller(thunk, ArgStruct);
      defineProperties(self, {
        length: defineValue(argCount),
        name: defineValue(''),
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
    // destructor needs to free the JS thunk on Zig side as well
    const { delete: { value: defaultDelete } } = descriptors;
    descriptors.delete = defineValue(function() {
      if (jsThunkController) {
        thisEnv.freeFunctionThunk(this[MEMORY], jsThunkController);
      }
      defaultDelete.call(this);
    });
    if (process.env.MIXIN === 'track') {
      if (jsThunkController) {
        this.usingFunctionPointer = true;
      }
    }
    return constructor;
  },
  /* c8 ignore start */
  ...(process.env.MIXIN === 'track' ? {
    usingFunction: false,
    usingFunctionPointer: false,
  } : undefined),
  /* c8 ignore end */
});
