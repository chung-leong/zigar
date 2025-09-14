import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { NoCastingToFunction, NoInitializer, TypeMismatch, Unsupported } from '../errors.js';
import { CONTROLLER, ENVIRONMENT, MEMORY, TYPE } from '../symbols.js';
import { defineProperties, defineValue, getSelf } from '../utils.js';

export default mixin({
  defineFunction(structure, descriptors) {
    const {
      instance: { members: [ member ], template: thunk },
    } = structure;
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
        if (ArgStruct[TYPE] === StructureType.VariadicStruct || !constructor[CONTROLLER]) {
          throw new Unsupported();
        }
        if (process.env.TARGET !== 'wasm' || thisEnv.instance) {
          // create an inbound thunk for function (from mixin "features/call-marshaling-inbound")
          dv = thisEnv.getFunctionThunk(arg, constructor[CONTROLLER]);
        }
      } else {
        if (this !== ENVIRONMENT) {
          // casting from buffer to function is allowed only if request comes from the runtime
          throw new NoCastingToFunction();
        }
        // casting a memory pointing to Zig binary
        dv = arg;
      }
      const argCount = ArgStruct.prototype.length;
      const self = (creating)
      ? thisEnv.createInboundCaller(arg, ArgStruct)
      : thisEnv.createOutboundCaller(thunk, ArgStruct);
      defineProperties(self, {
        length: defineValue(argCount),
        name: defineValue(creating ? arg.name : ''),
      });
      // make self an instance of this function type
      Object.setPrototypeOf(self, constructor.prototype);
      if (process.env.TARGET !== 'wasm' || dv) {
        self[MEMORY] = dv;
      } else {
        thisEnv.deferredThunks ??= [];
        thisEnv.deferredThunks.push({ target: self, fn: arg });
      }
      return self;
    };
    // make function type a superclass of Function
    Object.setPrototypeOf(constructor.prototype, Function.prototype);
    descriptors.valueOf = descriptors.toJSON = defineValue(getSelf);
    return constructor;
  },
  finalizeFunction(structure, staticDescriptors, descriptors) {
    const {
      static: { template },
    } = structure;
    staticDescriptors[CONTROLLER] = defineValue(template);
    // don't change the tag of functions
    descriptors[Symbol.toStringTag] = undefined;
  },
  ...(process.env.TARGET === 'wasm' ? {
    createDeferredThunks() {
      const list = this.deferredThunks;
      if (list) {
        for (const { target, fn } of list) {
          const { constructor } = target;
          const dv = this.getFunctionThunk(fn, constructor[CONTROLLER]);
          target[MEMORY] = dv;
        }
      }
    },
  } : undefined),
});
