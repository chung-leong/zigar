import { requireDataView, setDataView } from '../../data-view.js';
import {
  ArrayLengthMismatch, BufferExpected, BufferSizeMismatch, MissingInitializers, NoInitializer,
  NoProperty
} from '../../error.js';
import { isReadOnly } from '../../member.js';
import {
  ALL_KEYS, CACHE, CONST_TARGET, COPIER, GETTER, MEMORY, MEMORY_RESTORER, POINTER_VISITOR,
  PROP_SETTERS, SETTER, SLOTS
} from '../../symbol.js';
import { defineProperties, defineProperty, mixin } from '../class.js';

mixin({
  defineStructure(structure) {
    const { type } = structure;
    const name = `define${structureNames[type]}`;
    const f = this[name];
    /* c8 ignore start */
    if (process.env.DEV) {
      if (!f) {
        throw new Error(`Missing method: ${name}`);
      }
    }
    /* c8 ignore end */
    f.call(this, structure);
  },
  attachDescriptors(constructor, instanceDescriptors, staticDescriptors) {
    // create prototype for read-only objects
    const propSetters = {};
    for (const [ name, descriptor ] of Object.entries(instanceDescriptors)) {
      if (descriptor?.set) {
        // save the setters so we can initialize read-only objects
        if (name !== '$') {
          propSetters[name] = descriptor.set;
        }
      }
    }
    const { get, set } = instanceDescriptors.$;
    instanceDescriptors = {
      [ALL_KEYS]: { value: Object.keys(propSetters) },
      [SETTER]: { value: set },
      [GETTER]: { value: get },
      [PROP_SETTERS]: { value: propSetters },
      [CONST_TARGET]: { value: null },
      ...instanceDescriptors,
    };
    if (process.env.WASM) {
      instanceDescriptors[MEMORY_RESTORER] = { value: this.getMemoryRestorer(constructor[CACHE]) };
    }
    defineProperties(constructor.prototype, instanceDescriptors);
    defineProperties(constructor, staticDescriptors);
    return constructor;
  },
  createConstructor(structure, handlers) {
    const {
      byteSize,
      align,
      instance: { members, template },
    } = structure;
    const {
      modifier,
      initializer,
      finalizer,
      alternateCaster,
      shapeDefiner,
    } = handlers;
    const hasSlots = needSlots(members);
    // comptime fields are stored in the instance template's slots
    let comptimeFieldSlots;
    if (template?.[SLOTS]) {
      const comptimeMembers = members.filter(m => isReadOnly(m));
      if (comptimeMembers.length > 0) {
        comptimeFieldSlots = comptimeMembers.map(m => m.slot);
      }
    }
    const cache = new ObjectCache();
    const constructor = function(arg, options = {}) {
      const {
        fixed = false,
      } = options;
      const creating = this instanceof constructor;
      let self, dv;
      if (creating) {
        if (arguments.length === 0) {
          throw new NoInitializer(structure);
        }
        self = this;
        if (hasSlots) {
          self[SLOTS] = {};
        }
        if (shapeDefiner) {
          // provided by defineSlice(); the slice is different from other structures as it does not have
          // a fixed size; memory is allocated by the slice initializer based on the argument given
          initializer.call(self, arg, fixed);
          dv = self[MEMORY];
        } else {
          self[MEMORY] = dv = this.allocateMemory(byteSize, align, fixed);
        }
      } else {
        if (alternateCaster) {
          // casting from number, string, etc.
          self = alternateCaster.call(this, arg, options);
          if (self !== false) {
            return self;
          }
        }
        // look for buffer
        dv = requireDataView(structure, arg, env);
        if (self = cache.find(dv)) {
          return self;
        }
        self = Object.create(constructor.prototype);
        if (shapeDefiner) {
          setDataView.call(self, dv, structure, false, false, { shapeDefiner });
        } else {
          self[MEMORY] = dv;
        }
        if (hasSlots) {
          self[SLOTS] = {};
        }
      }
      if (comptimeFieldSlots) {
        for (const slot of comptimeFieldSlots) {
          self[SLOTS][slot] = template[SLOTS][slot];
        }
      }
      if (modifier) {
        modifier.call(self);
      }
      if (creating) {
        // initialize object unless it's been done already
        if (!shapeDefiner) {
          initializer.call(self, arg);
        }
      }
      if (finalizer) {
        self = finalizer.call(self);
      }
      return cache.save(dv, self);
    };
    defineProperty(constructor, CACHE, { value: cache });
    return constructor;
  },
  createDestructor() {
    return function() {
      const dv = this[MEMORY];
      this[MEMORY] = null;
      if (this[SLOTS]) {
        this[SLOTS] = {};
      }
      this.releaseFixedView(dv);
    };
  },
  createPropertyApplier(structure) {
    const { instance: { template } } = structure;
    return function(arg, fixed) {
      const argKeys = Object.keys(arg);
      const propSetters = this[PROP_SETTERS];
      const allKeys = this[ALL_KEYS];
      // don't accept unknown props
      for (const key of argKeys) {
        if (!(key in propSetters)) {
          throw new NoProperty(structure, key);
        }
      }
      // checking each name so that we would see inenumerable initializers as well
      let normalCount = 0;
      let normalFound = 0;
      let normalMissing = 0;
      let specialFound = 0;
      for (const key of allKeys) {
        const set = propSetters[key];
        if (set.special) {
          if (key in arg) {
            specialFound++;
          }
        } else {
          normalCount++;
          if (key in arg) {
            normalFound++;
          } else if (set.required) {
            normalMissing++;
          }
        }
      }
      if (normalMissing !== 0 && specialFound === 0) {
        const missing = allKeys.filter(k => propSetters[k].required && !(k in arg));
        throw new MissingInitializers(structure, missing);
      }
      if (specialFound + normalFound > argKeys.length) {
        // some props aren't enumerable
        for (const key of allKeys) {
          if (key in arg) {
            if (!argKeys.includes(key)) {
              argKeys.push(key)
            }
          }
        }
      }
      // apply default values unless all properties are initialized
      if (normalFound < normalCount && specialFound === 0) {
        if (template) {
          if (template[MEMORY]) {
            this[COPIER](template);
          }
          this[POINTER_VISITOR]?.(copyPointer, { vivificate: true, source: template });
        }
      }
      for (const key of argKeys) {
        const set = propSetters[key];
        set.call(this, arg[key], fixed);
      }
      return argKeys.length;
    };
  },
  getDataView(structure, arg) {
    const { type, byteSize, typedArray } = structure;
    let dv;
    // not using instanceof just in case we're getting objects created in other contexts
    const tag = arg?.[Symbol.toStringTag];
    if (tag === 'DataView') {
      // capture relationship between the view and its buffer
      dv = this.registerView(arg);
    } else if (tag === 'ArrayBuffer' || tag === 'SharedArrayBuffer') {
      dv = this.obtainView(arg, 0, arg.byteLength);
    } else if (typedArray && tag === typedArray.name || (tag === 'Uint8ClampedArray' && typedArray === Uint8Array)) {
      dv = this.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
    } else if (tag === 'Uint8Array' && typeof(Buffer) === 'function' && arg instanceof Buffer) {
      dv = this.obtainView(arg.buffer, arg.byteOffset, arg.byteLength);
    } else {
      const memory = arg?.[MEMORY];
      if (memory) {
        // arg a Zig data object
        const { constructor, instance: { members: [ member ] } } = structure;
        if (arg instanceof constructor) {
          // same type, no problem
          return memory;
        } else {
          if (isArrayLike(type)) {
            // make sure the arg has the same type of elements
            const { byteSize: elementSize, structure: { constructor: Child } } = member;
            const number = findElements(arg, Child);
            if (number !== undefined) {
              if (type === StructureType.Slice || number * elementSize === byteSize) {
                return memory;
              } else {
                throw new ArrayLengthMismatch(structure, null, arg);
              }
            }
          }
        }
      }
    }
    if (dv && byteSize !== undefined) {
      checkDataViewSize(dv, structure);
    }
    return dv;
  },
  requireDataView(structure, arg) {
    const dv = this.getDataView(structure, arg);
    if (!dv) {
      throw new BufferExpected(structure);
    }
    return dv;
  },
});

export function isNeeded() {
  return this.structures.length > 0;
}

export const StructureType = {
  Primitive: 0,
  Array: 1,
  Struct: 2,
  ExternStruct: 3,
  PackedStruct: 4,
  ArgStruct: 5,
  VariadicStruct: 6,
  ExternUnion: 7,
  BareUnion: 8,
  TaggedUnion: 9,
  ErrorUnion: 10,
  ErrorSet: 11,
  Enum: 12,
  Optional: 13,
  SinglePointer: 14,
  SlicePointer: 15,
  MultiPointer: 16,
  CPointer: 17,
  Slice: 18,
  Vector: 19,
  Opaque: 20,
  Function: 21,
};
const structureNames = Object.keys(StructureType);

export function getStructureName(type) {
  const name = structureNames[type];
  if (!name) {
    return;
  }
  return name.replace(/\B[A-Z]/g, m => ` ${m}`).toLowerCase();
}

export function isValueExpected(structure) {
  switch (structure?.type) {
    case StructureType.Primitive:
    case StructureType.ErrorUnion:
    case StructureType.Optional:
    case StructureType.Enum:
    case StructureType.ErrorSet:
      return true;
    default:
      return false;
  }
}

function checkDataViewSize(dv, structure) {
  const { byteSize, type } = structure;
  const isSizeMatching = type === StructureType.Slice
  ? dv.byteLength % byteSize === 0
  : dv.byteLength === byteSize;
  if (!isSizeMatching) {
    throw new BufferSizeMismatch(structure, dv);
  }
}

function findElements(arg, Child) {
  // casting to a array/slice
  const { constructor: Arg } = arg;
  if (Arg === Child) {
    // matching object
    return 1;
  } else if (Arg.child === Child) {
    // matching slice/array
    return arg.length;
  }
}

export class ObjectCache {
  map = new WeakMap();

  find(dv) {
    return this.map.get(dv);
  }

  save(dv, object) {
    this.map.set(dv, object);
    return object;
  }
}
