import { defineProperties } from './structure.js';
import { MemberType, getDescriptor } from './member.js';
import { getMemoryCopier, getMemoryResetter } from './memory.js';
import { requireDataView } from './data-view.js';
import { throwNoInitializer } from './error.js';
import { copyPointer, resetPointer } from './pointer.js';
import { getChildVivificators, getPointerVisitor } from './struct.js';
import { ALIGN, CHILD_VIVIFICATOR, MEMORY, MEMORY_COPIER, POINTER_VISITOR, SIZE, SLOTS, 
  VALUE_RESETTER } from './symbol.js';

export function defineErrorUnion(s, env) {
  const {
    byteSize,
    align,
    instance: { members },
    hasPointer,
  } = s;
  const { get: getValue, set: setValue } = getDescriptor(members[0], env);
  const { get: getError, set: setError } = getDescriptor(members[1], env);
  const { structure: errorStructure } = members[1];
  const { constructor: ErrorSet } = errorStructure;
  const set = function(value) {
    if (value instanceof Error) {
      setError.call(this, value);
      this[VALUE_RESETTER]();
      debugger;
      this[POINTER_VISITOR]?.(resetPointer);
    } else {
      // call setValue() first, in case it throws
      setValue.call(this, value);
      setError.call(this, null);
    }
  };
  const get = function() {
    const error = getError.call(this);
    if (error) {
      throw error;
    } else {
      return getValue.call(this);
    }
  };
  const check = function() {
    const error = getError.call(this);
    return !error;
  };
  const hasObject = !!members.find(m => m.type === MemberType.Object);
  const constructor = s.constructor = function(arg) {
    const creating = this instanceof constructor;
    let self, dv;
    if (creating) {
      if (arguments.length === 0) {
        throwNoInitializer(s);
      }
      self = this;
      dv = env.createBuffer(byteSize, align);
    } else {
      self = Object.create(constructor.prototype);
      dv = requireDataView(s, arg);
    }
    self[MEMORY] = dv;
    self[SLOTS] = hasObject ? {} : undefined;
    if (creating) {
      initializer.call(this, arg);
    } else {
      return self;
    }
  };
  const initializer = function(arg) {
    if (arg instanceof constructor) {
      this[MEMORY_COPIER](arg);
      if (hasPointer) {
        if (check.call(this)) {
          this[POINTER_VISITOR](copyPointer, { vivificate: true, source: arg });
        }
      }
    } else {
      this.$ = arg;
    }
  };
  const { bitOffset: valueBitOffset, byteSize: valueByteSize } = members[0];
  defineProperties(constructor.prototype, {
    '$': { get, set, configurable: true },
    [MEMORY_COPIER]: { value: getMemoryCopier(byteSize) },
    [VALUE_RESETTER]: { value: getMemoryResetter(valueBitOffset / 8, valueByteSize) },
    [CHILD_VIVIFICATOR]: hasObject && { value: getChildVivificators(s) },
    [POINTER_VISITOR]: hasPointer && { value: getPointerVisitor(s, { isChildActive: check }) },
  });
  defineProperties(constructor, {
    [ALIGN]: { value: align },
    [SIZE]: { value: byteSize },
  })
  return constructor;
}

