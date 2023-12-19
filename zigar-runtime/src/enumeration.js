import { defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { getDataView } from './data-view.js';
import { throwInvalidInitializer, throwReadOnly } from './error.js';
import { ALIGN, ENUM_ITEM, ENUM_ITEMS, MEMORY, MEMORY_COPIER, SIZE } from './symbol.js';

export function defineEnumerationShape(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
  } = s;
  const byIndex = {};
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
      dv = env.createBuffer(byteSize, align, fixed);
    } else {
      if (typeof(arg)  === 'string') {
        return constructor[arg];
      } else if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
        return byIndex[arg];
      } else if (arg && typeof(arg) === 'object' && arg[ENUM_ITEM]) {
        // a tagged union, return the active tag
        return arg[ENUM_ITEM];
      } else {
        self = Object.create(constructor.prototype);
        dv = getDataView(s, arg);
        if (!dv) {
          throwInvalidInitializer(s, [ 'string', 'number', 'tagged union' ], arg);
        } 
      }
    }
    self[MEMORY] = dv;
    if (creating) {
      set.call(self, arg);
    }
    if (writable) {
      defineProperties(constructor.prototype, {
        $: { get, set, configurable: true },
      });
    }
    return self; 
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
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [ENUM_ITEMS]: { value: byIndex },
  });
  return constructor;
};

