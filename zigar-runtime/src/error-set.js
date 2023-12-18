import { defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { getDataView } from './data-view.js';
import { throwReadOnly } from './error.js';
import { ALIGN, ERROR_ITEMS, MEMORY, MEMORY_COPIER, SIZE } from './symbol.js';

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
      if (typeof(arg) === 'number') {
        return byIndex[arg];  
      } else if (typeof(arg) === 'string') {
        for (const err of Object.values(constructor)) {
          if (err.toString() === arg) {
            return err;
          }
        }
      } else {
        self = Object.create(constructor.prototype);
        dv = getDataView(s, arg);
        if (!dv) {
          throwInvalidInitializer(s, [ 'string', 'number' ], arg);
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
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  const { get: getIndex } = getDescriptor(member, env);
  // get the enum descriptor instead of the int/uint descriptor
  const errorMember = { ...member, structure: s, type: MemberType.Error };
  const { get, set } = getDescriptor(errorMember, env);
  const toStringTag = function() { return 'Error' };
  defineProperties(constructor.prototype, {
    index: { get: getIndex, configurable: true },
    delete: { value: getDestructor(s), configurable: true },
    $: { get, set: throwReadOnly, configurable: true },
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
