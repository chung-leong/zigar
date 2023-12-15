import { defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getMemoryCopier } from './memory.js';
import { requireDataView } from './data-view.js';
import { throwNoNewError } from './error.js';
import { ALIGN, ENVIRONMENT, ERROR_ITEMS, MEMORY, MEMORY_COPIER, SIZE } from './symbol.js';

let currentErrorSets;

export function defineErrorSet(s, env) {
  const {
    name,
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
      throwNoNewError(s);
    }
    if (this === ENVIRONMENT) {
      // called by Environment.castView() or recreateStructures()
      // the only time when individual errors are created
      const self = Object.create(constructor.prototype);
      const dv = requireDataView(s, arg);
      self[MEMORY] = dv;
      return self;
    }
    const index = Number(arg);
    return byIndex[index];
  };
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  const { get: getIndex } = getDescriptor(member, env);
  // get the enum descriptor instead of the int/uint descriptor
  const errorMember = { ...member, structure: s, type: MemberType.Error };
  const { get, set } = getDescriptor(errorMember, env);
  const toStringTag = function() { return 'Error' };
  defineProperties(constructor.prototype, {
    $: { get, set, configurable: true },
    index: { get: getIndex, configurable: true },
    // ensure that libraries that rely on the string tag for type detection will
    // correctly identify the object as an error
    [Symbol.toStringTag]: { get: toStringTag, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
    [ERROR_ITEMS]: { value: byIndex },
  });
  return constructor;

};

export function initializeErrorSets() {
  currentErrorSets = {};
}

export function getCurrentErrorSets() {
  return currentErrorSets;
}
