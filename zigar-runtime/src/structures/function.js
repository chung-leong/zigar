import { StructureType } from '../constants.js';
import { mixin } from '../environment.js';
import { TypeMismatch } from '../errors.js';
import { LENGTH, MEMORY, VARIANTS } from '../symbols.js';
import { defineProperties, defineValue, ObjectCache } from '../utils.js';

export default mixin({
  defineFunction(structure, descriptors) {
    const {
      instance: { members: [ member ], template: thunk },
      static: { template: jsThunkConstructor },
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
        dv = thisEnv.getFunctionThunk(arg, jsThunkConstructor);
      } else {
        // casting a memory pointing to Zig binary
        dv = arg;
      }
      let existing;
      if (existing = cache.find(dv)) {
        return existing;
      }
      const { self, method, binary } = (creating)
      ? thisEnv.createInboundCallers(arg, ArgStruct)
      : thisEnv.createOutboundCallers(thunk, ArgStruct);
      defineProperties(self, {
        length: defineValue(ArgStruct[LENGTH]),
        [VARIANTS]: defineValue({ method, binary }),
        name: defineValue(''),
      });
      defineProperties(method, {
        length: defineValue(ArgStruct[LENGTH] - 1),
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
      return self;
    };
    // make function type a superclass of Funtion
    descriptors.constructor = defineValue(Object.create(Function.prototype));
    return constructor;
  },
});

export function isNeededByStructure(structure) {
  return structure.type === StructureType.Function;
}

