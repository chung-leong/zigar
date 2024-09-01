import { mixin } from '../environment.js';
import {
  MissingInitializers, NoInitializer, NoProperty
} from '../errors.js';
import { isReadOnly, MemberType } from '../members/all.js';
import {
  ALIGN, ALL_KEYS, CACHE, COMPAT, CONST_TARGET, COPIER, ENTRIES_GETTER, GETTER, MEMORY,
  POINTER_VISITOR, PROP_SETTERS, PROPS, SETTER, SIZE, SLOTS, TYPE, VARIANTS, WRITE_DISABLER,
} from '../symbols.js';
import { defineProperties, defineProperty } from '../utils.js';

export default mixin({
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
    return f.call(this, structure);
  },
  attachDescriptors(structure, instanceDescriptors, staticDescriptors, handlers) {
    const { byteSize, type, constructor, align, name } = structure;
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
      delete: { value: this.createDestructor() },
      [Symbol.toStringTag]: { value: structure.name },
      [ALL_KEYS]: { value: Object.keys(propSetters) },
      [SETTER]: { value: set },
      [GETTER]: { value: get },
      [COPIER]: this.getCopierDescriptor(byteSize, type === StructureType.Slice), // from mixin "memory/copying"
      [WRITE_DISABLER]: { value: makeReadOnly },
      [PROP_SETTERS]: { value: propSetters },
      [CONST_TARGET]: { value: null },
      ...this.getSpecialMethodDescriptors?.(), // from mixin "members/special-method"
      ...this.getSpecialPropertyDescriptors?.(structure, handlers), // from mixin "members/special-props"
      //...(process.env.TARGET === 'wasm' ? this.getWebAssemblyDescriptors(structure) : {}),
      ...instanceDescriptors,
    };
    staticDescriptors = {
      name: { value: name },
      [COMPAT]: { value: getCompatibleTags(structure) },
      [ALIGN]: { value: align },
      [SIZE]: { value: byteSize },
      [TYPE]: { value: type },
      ...staticDescriptors,
    };
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
    const thisEnv = this;
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
        dv = thisEnv.extractView(structure, arg);
        if (self = cache.find(dv)) {
          return self;
        }
        self = Object.create(constructor.prototype);
        if (shapeDefiner) {
          thisEnv.assignView(self, dv, structure, false, false, { shapeDefiner });
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
    const thisEnv = this;
    return function() {
      const dv = this[MEMORY];
      this[MEMORY] = null;
      if (this[SLOTS]) {
        this[SLOTS] = {};
      }
      thisEnv.releaseFixedView(dv);
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
  finalizeStructure(structure) {
    const {
      type,
      constructor,
      static: { members, template },
    } = structure;
    const staticDescriptors = {};
    const instanceDescriptors = {};
    for (const member of members) {
      const { name, slot, structure: { type, instance: { members: [ fnMember ] } } } = member;
      staticDescriptors[name] = this.getDescriptor(member);
      if (type === StructureType.Function) {
        const fn = template[SLOTS][slot];
        // provide a name if one isn't assigned yet
        if (!fn.name) {
          defineProperty(fn, 'name', { value: name });
        }
        // see if it's a getter or setter
        const [ accessorType, propName ] = /^(get|set)\s+([\s\S]+)/.exec(name)?.slice(1) ?? [];
        const argRequired = (accessorType === 'get') ? 0 : 1;
        if (accessorType && fn.length  === argRequired) {
          const descriptor = staticDescriptors[propName] ??= {};
          descriptor[accessorType] = fn;
        }
        // see if it's a method
        if (startsWithSelf(fnMember.structure, structure)) {
          const method = fn[VARIANTS].method;
          instanceDescriptors[name] = { value: method };
          if (accessorType && method.length  === argRequired) {
            const descriptor = instanceDescriptors[propName] ??= {};
            descriptor[accessorType] = method;
          }
        }
      }
    }
    defineProperties(constructor, {
      valueOf: this.getValueOfDescriptor?.(),
      toJSON: this.getToJsonDescriptor?.(),
      ...staticDescriptors,
      [Symbol.iterator]: { value: getStructIterator },
      [ENTRIES_GETTER]: { value: getStructEntries },
      // static variables are objects stored in the static template's slots
      [SLOTS]: template && { value: template[SLOTS] },
      // anyerror would have props already
      [PROPS]: !constructor[PROPS] && { value: members.map(m => m.name) },
    });
    defineProperties(constructor.prototype, instanceDescriptors);
    if (type === StructureType.Enum) {
      for (const { name, slot } of members) {
        appendEnumeration(constructor, name, constructor[SLOTS][slot]);
      }
    } else if (type === StructureType.ErrorSet) {
      for (const { name, slot } of members) {
        appendErrorSet(constructor, name, constructor[SLOTS][slot]);
      }
    }
  },
});

export function isNeededByStructure(structure) {
  return true;
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

export const structureNames = Object.keys(StructureType);

export function getStructureName(type) {
  const name = structureNames[type];
  if (!name) {
    return;
  }
  return name.replace(/\B[A-Z]/g, m => ` ${m}`).toLowerCase();
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

function needSlots(members) {
  for (const { type } of members) {
    switch (type) {
      case MemberType.Object:
      case MemberType.Comptime:
      case MemberType.Type:
      case MemberType.Literal:
        return true;
    }
  }
  return false;
}

function makeReadOnly() {
  const descriptors = Object.getOwnPropertyDescriptors(this.constructor.prototype);
  for (const [ name, descriptor ] of Object.entries(descriptors)) {
    if (descriptor.set) {
      descriptor.set = throwReadOnly;
      Object.defineProperty(this, name, descriptor);
    }
  }
  Object.defineProperty(this, SETTER, { value: throwReadOnly });
  Object.defineProperty(this, CONST_TARGET, { value: this });
}

function getCompatibleTags(structure) {
  const { typedArray } = structure;
  const tags = [];
  if (typedArray) {
    tags.push(typedArray.name);
    tags.push('DataView');
    if (typedArray === Uint8Array || typedArray === Int8Array) {
      tags.push('ArrayBuffer');
      tags.push('SharedArrayBuffer');
      if (typedArray === Uint8Array) {
        tags.push('Uint8ClampedArray');
      }
    }
  }
  return tags;
}

function startsWithSelf(argStructure, structure) {
  // get structure of first argument (members[0] is retval)
  const arg0Structure = argStructure.instance.members[1]?.structure;
  if (arg0Structure === structure) {
    return true;
  } else if (arg0Structure?.type === StructureType.SinglePointer) {
    const targetStructure = arg0Structure.instance.members[0].structure;
    if (targetStructure === structure) {
      return true;
    }
  }
  return false;
}
