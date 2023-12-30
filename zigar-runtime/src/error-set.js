import { ObjectCache, defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getDestructor, getMemoryCopier } from './memory.js';
import { getDataView } from './data-view.js';
import { throwInvalidInitializer, throwNoInitializer, throwReadOnly } from './error.js';
import { ALIGN, ERROR_ITEMS, ERROR_MESSAGES, MEMORY, MEMORY_COPIER, SIZE } from './symbol.js';

let currentErrorSets;

export function defineErrorSet(s, env) {
  const {
    name,
    byteSize,
    align,
    instance: { members: [ member ] },
  } = s;
  const byIndex = {};
  const messages = {};
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
      if (typeof(arg) === 'number') {
        return byIndex[arg];  
      } else if (typeof(arg) === 'string') {
        for (const err of Object.values(constructor)) {
          if (err.toString() === arg) {
            return err;
          }
        }
        return;
      } else {
        dv = getDataView(s, arg, env);
        if (!dv) {
          throwInvalidInitializer(s, [ 'string', 'number' ], arg);
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
      defineProperties(constructor.prototype, {
        $: { get, set, configurable: true },
      });
    }
    return cache.save(dv, writable, self);
  };
  Object.setPrototypeOf(constructor.prototype, Error.prototype);
  const { get: getIndex } = getDescriptor(member, env);
  const getMessage = function() {
    const index = getIndex.call(this);
    return messages[index];
  };
  // get the enum descriptor instead of the int/uint descriptor
  const errorMember = { ...member, structure: s, type: MemberType.Error };
  const { get, set } = getDescriptor(errorMember, env);
  const toStringTag = function() { return 'Error' };
  defineProperties(constructor.prototype, {
    index: { get: getIndex, configurable: true },
    message: { get: getMessage, configurable: true },
    delete: { value: getDestructor(env), configurable: true },
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
    [ERROR_MESSAGES]: { value: messages },
  });
  return constructor;

};

export function initializeErrorSets() {
  currentErrorSets = {};
}

export function getCurrentErrorSets() {
  return currentErrorSets;
}
