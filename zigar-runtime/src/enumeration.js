import { ObjectCache, defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { getDataView } from './data-view.js';
import { throwInvalidInitializer, throwNoInitializer, throwReadOnly } from './error.js';
import { ALIGN, CONST, ENUM_ITEM, ENUM_ITEMS, MEMORY, MEMORY_COPIER, SIZE } from './symbol.js';

export function defineEnumerationShape(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
  } = s;
  const byIndex = {};
  const cache = new ObjectCache();
  const constructor = s.constructor = function(arg, options = {}) {
    const {
      writable = true,
      fixed = false,
    } = options;
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.allocateMemory(byteSize, align, fixed);
    } else {
      if (typeof(arg)  === 'string') {
        return constructor[arg];
      } else if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
        return byIndex[arg];
      } else if (arg && typeof(arg) === 'object' && arg[ENUM_ITEM]) {
        // a tagged union, return the active tag
        return arg[ENUM_ITEM];
      } else {
        dv = getDataView(s, arg, env);
        if (!dv) {
          throwInvalidInitializer(s, [ 'string', 'number', 'tagged union' ], arg);
        } 
        if (self = cache.find(dv, writable)) {
          return self;
        }
        self = Object.create(constructor.prototype); 
      }
    }
    self[MEMORY] = dv;
    if (creating) {
      set.call(self, arg);
    }
    if (writable) {
      defineProperties(self, {
        $: { get, set, configurable: true },
        [CONST]: { value: undefined, configurable: true },
      });
    }
    return cache.save(dv, writable, self); 
  };
  const { get: getIndex } = getDescriptor(member, env);
  // get the enum descriptor instead of the int/uint descriptor
  const enumMember = { ...member, structure: s, type: MemberType.EnumerationItem };
  const { get, set } = getDescriptor(enumMember, env);
  defineProperties(constructor.prototype, {
    delete: { value: getDestructor(env), configurable: true },
    $: { get, set: throwReadOnly, configurable: true },
    [Symbol.toPrimitive]: { value: getIndex, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [CONST]: { value: true, configurable: true },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [ENUM_ITEMS]: { value: byIndex },
  });
  return constructor;
};

