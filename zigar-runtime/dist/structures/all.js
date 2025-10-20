import { StructureType, MemberType, MemberFlag, structureNames, StructureFlag, ProxyType } from '../constants.js';
import { mixin } from '../environment.js';
import { NoProperty, MissingInitializers, NoInitializer } from '../errors.js';
import { removeProxy } from '../proxies.js';
import { KEYS, SETTERS, MEMORY, SLOTS, CACHE, RESTORE, PROPS, ENTRIES, TYPED_ARRAY, FLAGS, TYPE, SIZE, ALIGN, ENVIRONMENT, SIGNATURE, TRANSFORM, SHAPE, INITIALIZE, CAST, RESTRICT, FINALIZE, PROXY, UPDATE } from '../symbols.js';
import { copyObject, ObjectCache, defineProperty, defineValue, defineProperties } from '../utils.js';

var all = mixin({
  defineStructure(structure) {
    const {
      type,
      byteSize,
    } = structure;
    const handlerName = `define${structureNames[type]}`;
    const f = this[handlerName];
    // default discriptors
    const keys = [];
    const setters = {};
    const descriptors = {
      dataView: this.defineDataView(structure),
      base64: this.defineBase64(structure),
      toJSON: this.defineToJSON(),
      valueOf: this.defineValueOf(),
      [SETTERS]: defineValue(setters),
      [KEYS]: defineValue(keys),
      ...({
        // add method for recoverng from array detachment
        [RESTORE]: this.defineRestorer(),
      } ),
    };
    const constructor = structure.constructor = f.call(this, structure, descriptors);
    for (const [ name, descriptor ] of Object.entries(descriptors)) {
      const s = descriptor?.set;
      if (s && !setters[name] && name !== '$') {
        setters[name] = s;
        keys.push(name);
      }
    }
    defineProperties(constructor.prototype, descriptors);
    return constructor;
  },
  finalizeStructure(structure) {
    const {
      name,
      type,
      constructor,
      align,
      byteSize,
      flags,
      signature,
      static: { members, template },
    } = structure;
    const props = [];
    const staticDescriptors = {
      name: defineValue(name),
      toJSON: this.defineToJSON(),
      valueOf: this.defineValueOf(),
      [SIGNATURE]: defineValue(signature),
      [ENVIRONMENT]: defineValue(this),
      [ALIGN]: defineValue(align),
      [SIZE]: defineValue(byteSize),
      [TYPE]: defineValue(type),
      [FLAGS]: defineValue(flags),
      [PROPS]: defineValue(props),
      [TYPED_ARRAY]: defineValue(this.getTypedArray(structure)),
      [Symbol.iterator]: this.defineStructIterator(),
      [ENTRIES]: this.defineStructEntries(),
      [PROPS]: defineValue(props),
    };
    const descriptors = {
      [Symbol.toStringTag]: defineValue(name),
    };
    if (members) {
      for (const member of members) {
        const { name, slot, flags } = member;
        if (member.structure.type === StructureType.Function) {
          let fn = template[SLOTS][slot];
          if (flags & MemberFlag.IsString) {
            fn[TRANSFORM] = (retval) => retval.string;
          } else if (flags & MemberFlag.IsClampedArray) {
            fn[TRANSFORM] = (retval) => retval.clampedArray;
          } else if (flags & MemberFlag.IsTypedArray) {
            fn[TRANSFORM] = (retval) => retval.typedArray;
          } else if (flags & MemberFlag.IsPlain) {
            fn[TRANSFORM] = (retval) => retval.valueOf();
          }
          staticDescriptors[name] = defineValue(fn);
          // provide a name if one isn't assigned yet
          if (!fn.name) {
            defineProperty(fn, 'name', defineValue(name));
          }
          // see if it's a getter or setter
          const [ accessorType, propName ] = /^(get|set)\s+([\s\S]+)/.exec(name)?.slice(1) ?? [];
          const argRequired = (accessorType === 'get') ? 0 : 1;
          if (accessorType && fn.length  === argRequired) {
            staticDescriptors[propName] ||= {};
            const descriptor = staticDescriptors[propName];
            descriptor[accessorType] = fn;
          }
          // see if it's a method
          if (flags & MemberFlag.IsMethod) {
            const method = function(...args) {
              try {
                let [ self, proxyType ] = removeProxy(this);
                if (flags & MemberFlag.IsExpectingInstance) {
                  if (proxyType === ProxyType.Pointer) {
                    self = self['*'];
                  }
                }
                return fn(self, ...args);
              } catch (err) {
                // adjust argument index/count
                err[UPDATE]?.(1);
                throw err;
              }
            };
            defineProperties(method, {
              name: defineValue(name),
              length: defineValue(fn.length - 1),
            });
            descriptors[name] = defineValue(method);
            if (accessorType && method.length === argRequired) {
              const descriptor = descriptors[propName] ||= {};
              descriptor[accessorType] = method;
            }
          }
        } else {
          staticDescriptors[name] = this.defineMember(member);
          props.push(name);
        }
      }
    }
    // static variable/constants are stored in slots
    staticDescriptors[SLOTS] = (props.length > 0) && defineValue(template[SLOTS]);
    const handlerName = `finalize${structureNames[type]}`;
    const f = this[handlerName];
    if (f?.call(this, structure, staticDescriptors, descriptors) !== false) {
      defineProperties(constructor.prototype, descriptors);
      defineProperties(constructor, staticDescriptors);
    }
  },
  createConstructor(structure, handlers = {}) {
    const {
      type,
      byteSize,
      align,
      flags,
      instance: { members, template },
    } = structure;
    const { onCastError } = handlers;
    // comptime fields are stored in the instance template's slots
    let comptimeFieldSlots;
    if (template?.[SLOTS]) {
      const comptimeMembers = members.filter(m => m.flags & MemberFlag.IsReadOnly);
      if (comptimeMembers.length > 0) {
        comptimeFieldSlots = comptimeMembers.map(m => m.slot);
      }
    }
    const cache = new ObjectCache();
    const thisEnv = this;
    const constructor = function(arg, options = {}) {
      const {
        allocator,
      } = options;
      const creating = this instanceof constructor;
      let self, dv, cached = false;
      if (creating) {
        if (arguments.length === 0) {
          throw new NoInitializer(structure);
        }
        self = this;
        if (flags & StructureFlag.HasSlot) {
          self[SLOTS] = {};
        }
        if (SHAPE in self) {
          // provided by defineStructureSlice(); the slice is different from other structures
          // as it does not have a zig size; memory is allocated by the slice initializer
          // based on the argument given
          self[INITIALIZE](arg, allocator);
          dv = self[MEMORY];
        } else {
          // don't use allocator to create storage for pointer
          const a = (type !== StructureType.Pointer) ? allocator : null;
          self[MEMORY] = dv = thisEnv.allocateMemory(byteSize, align, a);
        }
      } else {
        if (CAST in constructor) {
          // casting from number, string, etc.
          self = constructor[CAST].call(this, arg, options);
          if (self !== false) {
            return self;
          }
        }
        // look for buffer
        dv = thisEnv.extractView(structure, arg, onCastError);
        if (self = cache.find(dv)) {
          cached = true;
        } else {
          self = Object.create(constructor.prototype);
          if (SHAPE in self) {
            thisEnv.assignView(self, dv, structure, false, false);
          } else {
            self[MEMORY] = dv;
          }
          if (flags & StructureFlag.HasSlot) {
            self[SLOTS] = {};
          }
        }
      }
      if (!cached) {
        if (comptimeFieldSlots) {
          for (const slot of comptimeFieldSlots) {
            self[SLOTS][slot] = template[SLOTS][slot];
          }
        }
        self[RESTRICT]?.();
        if (creating) {
          // initialize object unless that's done already
          if (!(SHAPE in self)) {
            self[INITIALIZE](arg, allocator);
          }
        }
        if (FINALIZE in self) {
          self = self[FINALIZE]();
        }
        cache.save(dv, self);
      }
      if (flags & StructureFlag.HasProxy) {
        if (creating || !this) {
          return self[PROXY]();
        }
      }
      return self;
    };
    defineProperty(constructor, CACHE, defineValue(cache));
    {
      if (template?.[MEMORY]) {
        defineProperty(template, RESTORE, this.defineRestorer());
      }
    }
    return constructor;
  },
  createInitializer(handler) {
    return function(arg, allocator) {
      const [ argNoProxy, argProxyType ] = removeProxy(arg);
      const [ self ] = removeProxy(this);
      return handler.call(self, argNoProxy, allocator, argProxyType);
    }
  },
  createApplier(structure) {
    const { instance: { template } } = structure;
    return function(arg, allocator) {
      const [ argNoProxy ] = removeProxy(arg);
      const [ self ] = removeProxy(this);
      const argKeys = Object.keys(argNoProxy);
      if (argNoProxy instanceof Error) {
        throw argNoProxy;
      }
      const keys = self[KEYS];
      const setters = self[SETTERS];
      // don't accept unknown props
      for (const key of argKeys) {
        if (!(key in setters)) {
          throw new NoProperty(structure, key);
        }
      }
      // checking each name so that we would see inenumerable initializers as well
      let normalCount = 0;
      let normalFound = 0;
      let normalMissing = 0;
      let specialFound = 0;
      for (const key of keys) {
        const set = setters[key];
        if (set.special) {
          if (key in argNoProxy) {
            specialFound++;
          }
        } else {
          normalCount++;
          if (key in argNoProxy) {
            normalFound++;
          } else if (set.required) {
            normalMissing++;
          }
        }
      }
      if (normalMissing !== 0 && specialFound === 0) {
        const missing = keys.filter(k => setters[k].required && !(k in argNoProxy));
        throw new MissingInitializers(structure, missing);
      }
      if (specialFound + normalFound > argKeys.length) {
        // some props aren't enumerable
        for (const key of keys) {
          if (key in argNoProxy) {
            if (!argKeys.includes(key)) {
              argKeys.push(key);
            }
          }
        }
      }
      // apply default values unless all properties are initialized
      if (normalFound < normalCount && specialFound === 0) {
        if (template) {
          if (template[MEMORY]) {
            copyObject(self, template);
          }
        }
      }
      for (const key of argKeys) {
        const set = setters[key];
        set.call(self, argNoProxy[key], allocator);
      }
      return argKeys.length;
    };
  },
  getTypedArray(structure) {
    const { type, instance } = structure;
    if (type !== undefined && instance) {
      switch (type) {
        case StructureType.Enum:
        case StructureType.ErrorSet:
        case StructureType.Primitive: {
          const { byteSize, type } = instance.members[0];
          const intType = (type === MemberType.Float)
                        ? 'Float'
                        : (type === MemberType.Int) ? 'Int' : 'Uint';
          const prefix = (byteSize > 4 && type !== MemberType.Float) ? 'Big' : '';
          const arrayName = prefix + intType + (byteSize * 8) + 'Array';
          return globalThis[arrayName];
        }        case StructureType.Array:
        case StructureType.Slice:
        case StructureType.Vector:
          return this.getTypedArray(instance.members[0].structure);
      }
    }
  },
});

export { all as default };
