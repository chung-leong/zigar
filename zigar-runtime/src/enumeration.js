import { defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { addMethods } from './method.js';
import { throwInvalidInitializer, throwNoNewEnum } from './error.js';
import { ALIGN, ENUM_ITEM, ENVIRONMENT, MEMORY, MEMORY_COPIER, SIZE } from './symbol.js';
import { requireDataView } from './data-view.js';

export function defineEnumerationShape(s, env) {
  const {
    byteSize,
    align,
    instance: {
      members: [ member ],
    },
  } = s;
  /* DEV-TEST */
  for (const member of members) {
    if (member.bitOffset !== undefined) {
      throw new Error(`bitOffset must be undefined for enumeration member`);
    }
  }
  /* DEV-TEST-END */
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
      // add item to hash
      const index = self.valueOf();
      if (byIndex[index]) {
        // already defined--returning existing object
        return byIndex[index];
      } else {
        byIndex[index] = self;
        return self; 
      }
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
  const { get } = getDescriptor({ ...member, structure: s, type: MemberType.EnumerationItem }, env);
  defineProperties(constructor.prototype, {
    $: { get, configurable: true },
    valueOf: { value: getIndex, configurable: true, writable: true },
    [Symbol.toPrimitive]: { value: getIndex, configurable: true, writable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  });
  return constructor;
};

