import { defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { throwInvalidInitializer, throwNoNewEnum } from './error.js';
import { ALIGN, ENUM_ITEM, ENUM_ITEMS, ENVIRONMENT, MEMORY, MEMORY_COPIER, SIZE } from './symbol.js';
import { requireDataView } from './data-view.js';

export function defineEnumerationShape(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
  } = s;
  const byIndex = {};
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    if (creating) {
      // the "constructor" is only used to convert a number into an enum object
      // new enum items cannot be created
      throwNoNewEnum(s);
    }
    if (this === ENVIRONMENT) {
      // called by Environment.castView() or recreateStructures()
      // the only time when individual enum items are created
      const self = Object.create(constructor.prototype);
      const dv = requireDataView(s, arg);
      self[MEMORY] = dv;
      return self; 
    }
    if (typeof(arg)  === 'string') {
      return constructor[arg];
    } else if (typeof(arg) === 'number' || typeof(arg) === 'bigint') {
      return byIndex[arg];
    } else if (arg && typeof(arg) === 'object' && arg[ENUM_ITEM]) {
      // a tagged union, return the active tag
      return arg[ENUM_ITEM];
    } else {
      throwInvalidInitializer(s, [ 'string', 'number', 'tagged union' ], arg);
    }
  };
  const { get: getIndex } = getDescriptor(member, env);
  // get the enum descriptor instead of the int/uint descriptor
  const enumMember = { ...member, structure: s, type: MemberType.EnumerationItem };
  const { get } = getDescriptor(enumMember, env);
  defineProperties(constructor.prototype, {
    $: { get, configurable: true },
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

